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
export function registerIssueRoutes(app: Express) {
app.post("/api/issues", async (req, res, next) => {
  try {
    const parsed = z.object({
      userId: z.string(),
      stationId: z.string(),
      category: z.string().min(1),
      description: z.string().optional()
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: parsed.data.userId });
    if (!actor) return;

    const issue = await prisma.issueReport.create({
      data: { ...parsed.data, status: "OPEN" },
      include: { station: { include: { chargers: true } } }
    });
    await audit(parsed.data.userId, "ISSUE_REPORTED", "IssueReport", issue.id, issue.category);
    res.status(201).json(issue);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/issues/:id", requireRole(["STATION_OPERATOR", "ADMINISTRATOR"]), async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const issue = await prisma.issueReport.update({
      where: { id: routeParam(req, "id") },
      data: { status: parsed.data.status },
      include: { station: { include: { chargers: true } } }
    });
    await audit(userIdFromRequest(req), "ISSUE_STATUS_UPDATED", "IssueReport", issue.id, parsed.data.status);
    res.json(issue);
  } catch (error) {
    next(error);
  }
});
}

