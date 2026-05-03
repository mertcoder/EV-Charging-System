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
export function registerReportRoutes(app: Express) {
app.get("/api/admin/reports", requireRole(["ADMINISTRATOR"]), async (_req, res, next) => {
  try {
    res.json(await buildReports(true));
  } catch (error) {
    next(error);
  }
});

app.get("/api/operator/reports", requireRole(["STATION_OPERATOR", "ADMINISTRATOR"]), async (_req, res, next) => {
  try {
    res.json(await buildReports(false));
  } catch (error) {
    next(error);
  }
});
}

