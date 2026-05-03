import { prisma } from "../db";

export async function notify(userId: string, type: string, message: string) {
  return prisma.notification.create({
    data: { userId, type, message }
  });
}

export async function notifyStationSubscribers(stationId: string, type: string, message: string) {
  const [favorites, reservations] = await Promise.all([
    prisma.favoriteStation.findMany({ where: { stationId }, select: { userId: true } }),
    prisma.reservation.findMany({
      where: { status: "CONFIRMED", startTime: { gt: new Date() }, charger: { stationId } },
      select: { userId: true }
    })
  ]);
  const userIds = [...new Set([...favorites.map((favorite) => favorite.userId), ...reservations.map((reservation) => reservation.userId)])];
  await Promise.all(userIds.map((userId) => notify(userId, type, message)));
  return userIds.length;
}
