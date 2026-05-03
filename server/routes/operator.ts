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
export function registerOperatorRoutes(app: Express) {
app.patch("/api/operator/chargers/:id/status", requireRole(["STATION_OPERATOR", "ADMINISTRATOR"]), async (req, res, next) => {
  try {
    const parsed = z.object({
      status: z.enum(["AVAILABLE", "IN_USE", "RESERVED", "OUT_OF_SERVICE"]),
      pricePerKwh: z.coerce.number().positive().optional()
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }

    const charger = await prisma.charger.update({
      where: { id: routeParam(req, "id") },
      data: {
        status: parsed.data.status,
        ...(parsed.data.pricePerKwh ? { pricePerKwhCents: toCents(parsed.data.pricePerKwh) } : {})
      },
      include: { station: true }
    });

    let affected = 0;
    if (parsed.data.status === "OUT_OF_SERVICE") {
      const futureReservations = await prisma.reservation.findMany({
        where: { chargerId: charger.id, status: "CONFIRMED", startTime: { gt: new Date() } }
      });
      affected = futureReservations.length;
      for (const reservation of futureReservations) {
        const cancelled = await prisma.reservation.update({ where: { id: reservation.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
        const refundCents = await refundReservationHold(cancelled, "Out-of-service reservation refund");
        const stationName = (charger as typeof charger & { station: { name: string } }).station.name;
        await notify(reservation.userId, "RESERVATION_CANCELLED", `${stationName} reservation cancelled because the charger was marked out of service. ${fromCents(refundCents)} TL was refunded.`);
      }
    }
    await notifyStationSubscribers(charger.stationId, "AVAILABILITY_CHANGED", `${charger.station.name} / ${charger.code} is now ${charger.status.replace(/_/g, " ").toLowerCase()}.`);

    await audit(userIdFromRequest(req), "CHARGER_STATUS_UPDATED", "Charger", charger.id, `${charger.code} -> ${charger.status}; affected reservations: ${affected}.`);
    res.json({ charger, affectedReservations: affected });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/operator/stations/:id", requireRole(["STATION_OPERATOR", "ADMINISTRATOR"]), async (req, res, next) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(1).optional(),
      address: z.string().trim().min(1).optional(),
      operatingStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      operatingEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      status: z.enum(["AVAILABLE", "MAINTENANCE", "CLOSED"]).optional()
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }

    const station = await prisma.chargingStation.update({
      where: { id: routeParam(req, "id") },
      data: parsed.data,
      include: { chargers: true }
    });
    await notifyStationSubscribers(station.id, "AVAILABILITY_CHANGED", `${station.name} details were updated by the operator.`);
    await audit(userIdFromRequest(req), "STATION_CONFIGURATION_UPDATED", "ChargingStation", station.id, `${station.name}; ${station.address}; ${station.operatingStart}-${station.operatingEnd}; ${station.status}`);
    res.json(station);
  } catch (error) {
    next(error);
  }
});
}

