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
export function registerAuditRoutes(app: Express) {
app.get("/api/audit", requireRole(["ADMINISTRATOR"]), async (_req, res, next) => {
  try {
    const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    const chainRows = await prisma.auditLog.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    res.json({ rows, chainValid: verifyAuditChain(chainRows) });
  } catch (error) {
    next(error);
  }
});
}

