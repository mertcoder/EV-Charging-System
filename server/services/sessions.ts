import { calculateSessionCost, fromCents, receiptNumber, toCents } from "../domain";
import { prisma } from "../db";
import { audit } from "./audit";
import { notify } from "./notifications";

export async function settleProjectedSession(session: any, wallet: { id: string; balanceCents: number }, finalEndSoc: number, stopReason: string) {
  const unitPrice = fromCents(session.unitPriceCents);
  const cost = calculateSessionCost(session.reservation.vehicle.batteryCapacityKwh, session.startSoc, finalEndSoc, unitPrice);
  const costCents = toCents(cost.totalCost);
  const holdCents = session.reservation.holdAmountCents;
  const extraNeededCents = Math.max(0, costCents - holdCents);
  const extraDeductCents = Math.min(wallet.balanceCents, extraNeededCents);
  const finalCostCents = Math.min(costCents, holdCents + extraDeductCents);
  const refundCents = Math.max(0, holdCents - finalCostCents);
  const interrupted = stopReason === "WALLET_DEPLETED";
  const receipt = receiptNumber("CHG");

  if (extraDeductCents > 0) {
    await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: { decrement: extraDeductCents } } });
    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "CHARGE",
        amountCents: extraDeductCents,
        description: "Live session auto-stop settlement",
        receiptNumber: receipt
      }
    });
  }
  if (refundCents > 0) {
    await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: { increment: refundCents } } });
    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "REFUND",
        amountCents: refundCents,
        description: "Unused reservation hold refund after live auto-stop",
        receiptNumber: receiptNumber("REF")
      }
    });
  }

  const completed = await prisma.chargingSession.update({
    where: { id: session.id },
    data: {
      endTime: new Date(),
      endSoc: finalEndSoc,
      energyKwh: cost.consumedKwh,
      totalCostCents: finalCostCents,
      receiptNumber: receipt,
      status: interrupted ? "INTERRUPTED" : "COMPLETED",
      syncStatus: "SERVER_PROJECTED_AUTO_STOP"
    },
    include: { reservation: { include: { vehicle: true, charger: { include: { station: true } } } } }
  });
  await prisma.reservation.update({
    where: { id: session.reservationId },
    data: { status: "COMPLETED", holdAmountCents: 0, refundAmountCents: session.reservation.refundAmountCents + refundCents }
  });
  await prisma.charger.update({ where: { id: session.chargerId }, data: { status: "AVAILABLE" } });
  if (interrupted) {
    await notify(session.userId, "LOW_BALANCE", "Charging auto-stopped because wallet balance was depleted.");
  }
  await notify(session.userId, "CHARGING_COMPLETED", `Charging auto-stopped by ${stopReason.replace(/_/g, " ").toLowerCase()}: ${cost.consumedKwh} kWh, ${fromCents(finalCostCents)} TL.`);
  await audit(session.userId, interrupted ? "CHARGING_INTERRUPTED" : "CHARGING_AUTO_STOPPED", "ChargingSession", session.id, `Server projection auto-stop reason: ${stopReason}; final cost ${fromCents(finalCostCents)} TL.`);
  return completed;
}
