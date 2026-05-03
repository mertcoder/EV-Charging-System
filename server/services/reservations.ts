import { fromCents, receiptNumber } from "../domain";
import { prisma } from "../db";
import { audit } from "./audit";
import { notify } from "./notifications";

export async function refundReservationHold(reservation: { id: string; userId: string; holdAmountCents: number; refundAmountCents: number }, description: string) {
  const refundCents = reservation.holdAmountCents;
  if (refundCents <= 0) return 0;

  const wallet = await prisma.wallet.findUnique({ where: { userId: reservation.userId } });
  if (!wallet) return 0;

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balanceCents: { increment: refundCents } }
  });
  await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      type: "REFUND",
      amountCents: refundCents,
      description,
      receiptNumber: receiptNumber("REF")
    }
  });
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      holdAmountCents: 0,
      refundAmountCents: reservation.refundAmountCents + refundCents
    }
  });

  return refundCents;
}

export async function sweepNoShows() {
  const threshold = new Date(Date.now() - 15 * 60 * 1000);
  const expired = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      startTime: { lt: threshold },
      session: null
    },
    include: { charger: { include: { station: true } } }
  });

  for (const reservation of expired) {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "NO_SHOW", noShowAt: new Date() }
    });
    await prisma.charger.update({ where: { id: reservation.chargerId }, data: { status: "AVAILABLE" } });
    const refundCents = await refundReservationHold(reservation, "No-show hold release");
    await notify(reservation.userId, "RESERVATION_CANCELLED", `Reservation expired after 15 minutes. ${fromCents(refundCents)} TL hold was released.`);
    await audit(reservation.userId, "RESERVATION_NO_SHOW", "Reservation", reservation.id, "Automatic no-show sweep applied after 15 minutes.");
  }

  return expired.length;
}
