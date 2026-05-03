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
export function registerReservationRoutes(app: Express) {
app.post("/api/reservations", async (req, res, next) => {
  try {
    const parsed = reservationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: parsed.data.userId });
    if (!actor) return;

    const [vehicle, charger, wallet] = await Promise.all([
      prisma.vehicle.findUnique({ where: { id: parsed.data.vehicleId } }),
      prisma.charger.findUnique({ where: { id: parsed.data.chargerId }, include: { station: true } }),
      prisma.wallet.findUnique({ where: { userId: parsed.data.userId } })
    ]);

    if (!vehicle || !charger || !wallet) {
      res.status(404).json({ errors: ["Vehicle, charger, or wallet could not be found."] });
      return;
    }
    if (vehicle.userId !== actor.id) {
      res.status(403).json({ error: "Cannot reserve with another user's vehicle." });
      return;
    }

    const existingReservations = await prisma.reservation.findMany({
      where: { chargerId: charger.id },
      select: { startTime: true, endTime: true, status: true }
    });

    const unitPrice = fromCents(charger.pricePerKwhCents);
    const estimatedCost = estimateReservationCost(charger.powerKw, unitPrice, parsed.data.startTime, parsed.data.endTime);
    const estimatedCostCents = toCents(estimatedCost);
    const errors = validateReservationRules({
      vehicleConnectorType: vehicle.connectorType,
      chargerConnectorType: charger.connectorType,
      chargerStatus: charger.status,
      stationStatus: charger.station.status,
      stationOperatingStart: charger.station.operatingStart,
      stationOperatingEnd: charger.station.operatingEnd,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      existingReservations,
      walletBalance: fromCents(wallet.balanceCents),
      estimatedCost
    });

    if (errors.length) {
      res.status(400).json({ errors, estimatedCost });
      return;
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          userId: parsed.data.userId,
          vehicleId: parsed.data.vehicleId,
          chargerId: parsed.data.chargerId,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          status: "CONFIRMED",
          estimatedCostCents,
          holdAmountCents: estimatedCostCents
        },
        include: { vehicle: true, charger: { include: { station: true } } }
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: { decrement: estimatedCostCents } }
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "HOLD",
          amountCents: estimatedCostCents,
          description: `Reservation hold for ${charger.station.name} / ${charger.code}`
        }
      });
      await tx.charger.update({ where: { id: charger.id }, data: { status: "RESERVED" } });
      return created;
    });

    await notify(parsed.data.userId, "RESERVATION_CONFIRMED", `Reservation confirmed for ${charger.station.name} / ${charger.code}.`);
    await audit(parsed.data.userId, "RESERVATION_CREATED", "Reservation", reservation.id, `Estimated cost ${estimatedCost} TL reserved as wallet hold, route ready for ${charger.station.name}.`);

    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
});

app.post("/api/reservations/:id/cancel", async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: routeParam(req, "id") },
      include: { charger: true }
    });

    if (!reservation) {
      res.status(404).json({ error: "Reservation not found." });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: reservation.userId });
    if (!actor) return;

    const cancelledBase = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED", cancelledAt: new Date() }
    });
    const refundCents = await refundReservationHold(cancelledBase, "Reservation cancellation refund");

    await prisma.charger.update({ where: { id: reservation.chargerId }, data: { status: "AVAILABLE" } });
    const cancelled = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: { vehicle: true, charger: { include: { station: true } } }
    });
    await notify(reservation.userId, "RESERVATION_CANCELLED", `Reservation cancelled. Refund result: ${fromCents(refundCents)} TL was returned to your wallet.`);
    await audit(reservation.userId, "RESERVATION_CANCELLED", "Reservation", reservation.id, `Cancellation completed; refunded ${fromCents(refundCents)} TL.`);

    res.json(cancelled);
  } catch (error) {
    next(error);
  }
});

app.post("/api/reservations/:id/no-show", async (req, res, next) => {
  try {
    const existingReservation = await prisma.reservation.findUnique({
      where: { id: routeParam(req, "id") },
      include: { charger: { include: { station: true } }, vehicle: true }
    });

    if (!existingReservation) {
      res.status(404).json({ error: "Reservation not found." });
      return;
    }

    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: existingReservation.userId });
    if (!actor) return;

    const reservation = await prisma.reservation.update({
      where: { id: existingReservation.id },
      data: { status: "NO_SHOW", noShowAt: new Date() },
      include: { charger: { include: { station: true } }, vehicle: true }
    });
    const refundCents = await refundReservationHold(reservation, "No-show hold release");

    await prisma.charger.update({ where: { id: reservation.chargerId }, data: { status: "AVAILABLE" } });
    await notify(reservation.userId, "RESERVATION_CANCELLED", `Reservation expired, you did not start charging within 15 minutes. ${fromCents(refundCents)} TL hold was released.`);
    await audit(reservation.userId, "RESERVATION_NO_SHOW", "Reservation", reservation.id, "No-show rule applied after 15 minutes.");
    res.json(await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id }, include: { charger: { include: { station: true } }, vehicle: true } }));
  } catch (error) {
    next(error);
  }
});
}

