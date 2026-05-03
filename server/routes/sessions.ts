import type { Express } from "express";
import { z } from "zod";
import { requirements } from "../../src/shared/requirements";
import {
  calculateSessionCost,
  estimateReservationCost,
  fromCents,
  normalizePlate,
  receiptNumber,
  reservationInputSchema,
  sessionCompleteSchema,
  sessionStartSchema,
  toCents,
  validateReservationRules,
  validateVehicleBusinessRules,
  vehicleInputSchema
} from "../domain";
import { prisma } from "../db";
import { seedDatabase } from "../seedData";
import {
  audit,
  authorizeRequest,
  buildReports,
  formatZodError,
  notify,
  notifyStationSubscribers,
  refundReservationHold,
  requireRole,
  roleFromRequest,
  routeParam,
  settleProjectedSession,
  stationsWithReservedWindows,
  sweepNoShows,
  userIdFromRequest,
  verifyAuditChain
} from "../services/core";
export function registerSessionRoutes(app: Express) {
app.post("/api/sessions/start", async (req, res, next) => {
  try {
    const parsed = sessionStartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: parsed.data.reservationId },
      include: { charger: { include: { station: true } }, vehicle: true }
    });

    if (!reservation || reservation.status !== "CONFIRMED") {
      res.status(400).json({ errors: ["A valid confirmed reservation is required to start charging."] });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: reservation.userId });
    if (!actor) return;

    if (reservation.charger.status === "OUT_OF_SERVICE") {
      res.status(400).json({ errors: ["The selected charger is out of service."] });
      return;
    }

    const session = await prisma.chargingSession.create({
      data: {
        reservationId: reservation.id,
        userId: reservation.userId,
        chargerId: reservation.chargerId,
        startTime: new Date(),
        startSoc: parsed.data.startSoc,
        targetSoc: parsed.data.targetSoc,
        unitPriceCents: reservation.charger.pricePerKwhCents,
        status: "ACTIVE"
      },
      include: { reservation: { include: { vehicle: true, charger: { include: { station: true } } } } }
    });

    await prisma.charger.update({ where: { id: reservation.chargerId }, data: { status: "IN_USE" } });
    await notify(reservation.userId, "CHARGING_STARTED", `Charging started at ${reservation.charger.station.name}.`);
    await audit(reservation.userId, "CHARGING_STARTED", "ChargingSession", session.id, `Start SoC ${session.startSoc}%.`);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:id/complete", async (req, res, next) => {
  try {
    const parsed = sessionCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }

    const session = await prisma.chargingSession.findUnique({
      where: { id: routeParam(req, "id") },
      include: { reservation: { include: { vehicle: true, charger: { include: { station: true } } } } }
    });

    if (!session || session.status !== "ACTIVE") {
      res.status(400).json({ errors: ["An active charging session is required."] });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: session.userId });
    if (!actor) return;

    const wallet = await prisma.wallet.findUnique({ where: { userId: session.userId } });
    if (!wallet) {
      res.status(404).json({ errors: ["Wallet not found."] });
      return;
    }

    const requestedEndSoc = parsed.data.endSoc ?? session.targetSoc ?? 80;
    const effectiveEndSoc = session.targetSoc ? Math.min(requestedEndSoc, session.targetSoc) : requestedEndSoc;
    const autoStoppedAtTarget = Boolean(session.targetSoc && requestedEndSoc >= session.targetSoc);
    const unitPrice = fromCents(session.unitPriceCents);
    const requestedCost = calculateSessionCost(session.reservation.vehicle.batteryCapacityKwh, session.startSoc, effectiveEndSoc, unitPrice);
    const requestedCostCents = toCents(requestedCost.totalCost);
    const holdCents = session.reservation.holdAmountCents;
    const extraNeededCents = Math.max(0, requestedCostCents - holdCents);
    const extraDeductCents = Math.min(wallet.balanceCents, extraNeededCents);
    const coveredCostCents = Math.min(requestedCostCents, holdCents + extraDeductCents);
    const insufficientBalance = extraDeductCents < extraNeededCents;
    const interrupted = Boolean(parsed.data.simulateChargerMalfunction || insufficientBalance);
    const coveredEnergyKwh = unitPrice > 0 ? fromCents(coveredCostCents) / unitPrice : 0;
    const coveredSoc = session.startSoc + (coveredEnergyKwh / session.reservation.vehicle.batteryCapacityKwh) * 100;
    const finalEndSoc = insufficientBalance ? Math.min(effectiveEndSoc, Math.round(coveredSoc * 10) / 10) : effectiveEndSoc;
    const finalCost = calculateSessionCost(session.reservation.vehicle.batteryCapacityKwh, session.startSoc, finalEndSoc, unitPrice);
    const finalCostCents = Math.min(toCents(finalCost.totalCost), coveredCostCents);
    const receipt = receiptNumber("CHG");

    if (extraDeductCents > 0) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: { decrement: extraDeductCents } }
      });
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: "CHARGE",
          amountCents: extraDeductCents,
          description: interrupted ? "Partial charging fee after wallet depletion" : "Charging fee beyond reservation hold",
          receiptNumber: receipt
        }
      });
    }

    const refundCents = Math.max(0, holdCents - finalCostCents);
    if (refundCents > 0) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: { increment: refundCents } }
      });
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: "REFUND",
          amountCents: refundCents,
          description: "Unused reservation hold refund after final settlement",
          receiptNumber: receiptNumber("REF")
        }
      });
    }

    const completed = await prisma.chargingSession.update({
      where: { id: session.id },
      data: {
        endTime: new Date(),
        endSoc: finalEndSoc,
        energyKwh: finalCost.consumedKwh,
        totalCostCents: finalCostCents,
        receiptNumber: receipt,
        status: interrupted ? "INTERRUPTED" : "COMPLETED",
        syncStatus: parsed.data.simulateConnectivityLoss ? "CACHED_THEN_SYNCED_WITHIN_30_SECONDS" : "SYNCED"
      },
      include: { reservation: { include: { vehicle: true, charger: { include: { station: true } } } } }
    });

    await prisma.reservation.update({
      where: { id: session.reservationId },
      data: {
        status: "COMPLETED",
        holdAmountCents: 0,
        refundAmountCents: session.reservation.refundAmountCents + refundCents
      }
    });
    await prisma.charger.update({ where: { id: session.chargerId }, data: { status: "AVAILABLE" } });

    if (insufficientBalance) {
      await notify(session.userId, "LOW_BALANCE", "Charging stopped - wallet balance depleted. Please top up.");
    }

    await notify(session.userId, "CHARGING_COMPLETED", `Charging completed: ${finalCost.consumedKwh} kWh, ${fromCents(finalCostCents)} TL.${autoStoppedAtTarget ? " Target SoC auto-stop applied." : ""}`);
    await audit(session.userId, interrupted ? "CHARGING_INTERRUPTED" : "CHARGING_COMPLETED", "ChargingSession", session.id, `Receipt ${receipt}; consumed ${finalCost.consumedKwh} kWh; final cost ${fromCents(finalCostCents)} TL; refunded ${fromCents(refundCents)} TL; end SoC ${finalEndSoc}%.${autoStoppedAtTarget ? " Target SoC auto-stop applied." : ""}`);

    res.json(completed);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:id/simulate-sync", async (req, res, next) => {
  try {
    const existingSession = await prisma.chargingSession.findUnique({ where: { id: routeParam(req, "id") } });
    if (!existingSession) {
      res.status(404).json({ error: "Charging session not found." });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: existingSession.userId });
    if (!actor) return;

    const session = await prisma.chargingSession.update({
      where: { id: existingSession.id },
      data: { syncStatus: "CACHED_THEN_SYNCED_WITHIN_30_SECONDS" }
    });
    await audit(session.userId, "SESSION_SYNC_RECOVERED", "ChargingSession", session.id, "Temporary connectivity loss recovered within 30 seconds.");
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.get("/api/sessions/:id/projection", async (req, res, next) => {
  try {
    const session = await prisma.chargingSession.findUnique({
      where: { id: routeParam(req, "id") },
      include: { reservation: { include: { vehicle: true, charger: { include: { station: true } } } } }
    });
    if (!session || session.status !== "ACTIVE") {
      res.status(404).json({ error: "Active charging session not found." });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: session.userId });
    if (!actor) return;

    const wallet = await prisma.wallet.findUnique({ where: { userId: session.userId } });
    if (!wallet) {
      res.status(404).json({ error: "Wallet not found." });
      return;
    }

    const unitPrice = fromCents(session.unitPriceCents);
    const elapsedMinutes = Math.max(0, (Date.now() - session.startTime.getTime()) / (1000 * 60));
    const cappedElapsedMinutes = Math.min(120, elapsedMinutes);
    const batteryKwh = session.reservation.vehicle.batteryCapacityKwh;
    const targetSoc = session.targetSoc ?? 100;
    const targetEnergyKwh = Math.max(0, ((targetSoc - session.startSoc) / 100) * batteryKwh);
    const timeEnergyKwh = session.reservation.charger.powerKw * (cappedElapsedMinutes / 60);
    const walletEnergyKwh = unitPrice > 0 ? fromCents(session.reservation.holdAmountCents + wallet.balanceCents) / unitPrice : Number.MAX_SAFE_INTEGER;
    const projectedEnergyKwh = Math.max(0, Math.min(timeEnergyKwh, targetEnergyKwh, walletEnergyKwh));
    const projectedEndSoc = Math.min(100, Math.round((session.startSoc + (projectedEnergyKwh / batteryKwh) * 100) * 10) / 10);
    const projectedCost = calculateSessionCost(batteryKwh, session.startSoc, projectedEndSoc, unitPrice);
    const stopReason =
      elapsedMinutes >= 120
        ? "TWO_HOUR_LIMIT"
        : targetEnergyKwh > 0 && projectedEnergyKwh >= targetEnergyKwh
          ? "TARGET_SOC"
          : walletEnergyKwh <= timeEnergyKwh && walletEnergyKwh <= targetEnergyKwh
            ? "WALLET_DEPLETED"
            : null;

    const completed = stopReason ? await settleProjectedSession(session, wallet, projectedEndSoc, stopReason) : null;

    res.json({
      session: completed ?? session,
      elapsedMinutes: Math.round(elapsedMinutes),
      projectedEndSoc,
      projectedEnergyKwh: projectedCost.consumedKwh,
      projectedCost: projectedCost.totalCost,
      stopReason,
      autoStopped: Boolean(completed)
    });
  } catch (error) {
    next(error);
  }
});
}

