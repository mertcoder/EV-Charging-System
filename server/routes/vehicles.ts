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
export function registerVehicleRoutes(app: Express) {
app.post("/api/vehicles", async (req, res, next) => {
  try {
    const parsed = vehicleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: parsed.data.userId });
    if (!actor) return;

    const existingVehicles = await prisma.vehicle.findMany({ select: { plateNumber: true } });
    const businessErrors = validateVehicleBusinessRules(parsed.data, existingVehicles.map((vehicle) => vehicle.plateNumber));
    if (businessErrors.length) {
      res.status(400).json({ errors: businessErrors });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        userId: parsed.data.userId,
        brand: parsed.data.brand.trim(),
        modelName: parsed.data.modelName.trim(),
        batteryCapacityKwh: parsed.data.batteryCapacityKwh,
        connectorType: parsed.data.connectorType,
        plateNumber: normalizePlate(parsed.data.plateNumber)
      }
    });

    await audit(parsed.data.userId, "VEHICLE_REGISTERED", "Vehicle", vehicle.id, `${vehicle.brand} ${vehicle.modelName} (${vehicle.plateNumber}) registered.`);
    res.status(201).json(vehicle);
  } catch (error) {
    next(error);
  }
});
}

