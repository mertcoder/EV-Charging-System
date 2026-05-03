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
export function registerSecurityRoutes(app: Express) {
app.post("/api/security/simulate-failed-login", async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email().default("driver@group28.demo") }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const attempt = await prisma.failedLoginAttempt.upsert({
      where: { email: parsed.data.email },
      update: { count: { increment: 1 }, lastAttemptAt: new Date() },
      create: { email: parsed.data.email, count: 1, lastAttemptAt: new Date() }
    });
    const thresholdReached = attempt.count >= 3;

    if (thresholdReached) {
      const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR", isActive: true } });
      await Promise.all(admins.map((admin) => notify(admin.id, "SECURITY_ALERT", `Repeated failed login attempts detected for ${parsed.data.email}.`)));
      await audit(undefined, "FAILED_LOGIN_THRESHOLD_REACHED", "Security", undefined, `Failed login threshold reached for ${parsed.data.email}; attempts: ${attempt.count}.`);
      res.json({ ok: true, attempts: attempt.count, thresholdReached, message: "Security alert generated for administrator." });
      return;
    }

    await audit(undefined, "FAILED_LOGIN_RECORDED", "Security", undefined, `Failed login attempt recorded for ${parsed.data.email}; attempts: ${attempt.count}.`);
    res.json({ ok: true, attempts: attempt.count, thresholdReached, message: "Failed login attempt recorded." });
  } catch (error) {
    next(error);
  }
});
}

