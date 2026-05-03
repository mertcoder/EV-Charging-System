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
export function registerWalletRoutes(app: Express) {
app.post("/api/wallet/top-up", async (req, res, next) => {
  try {
    const parsed = z.object({ userId: z.string(), amount: z.coerce.number().positive() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: parsed.data.userId });
    if (!actor) return;
    const amountCents = toCents(parsed.data.amount);

    const wallet = await prisma.wallet.update({
      where: { userId: parsed.data.userId },
      data: { balanceCents: { increment: amountCents } }
    });
    const transaction = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "TOP_UP",
        amountCents,
        description: "Secure payment gateway top-up stub",
        receiptNumber: receiptNumber("TOP")
      }
    });
    await audit(parsed.data.userId, "WALLET_TOP_UP", "Transaction", transaction.id, `${parsed.data.amount} TL wallet top-up.`);
    res.status(201).json({ wallet, transaction });
  } catch (error) {
    next(error);
  }
});
}

