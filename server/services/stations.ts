import { prisma } from "../db";

export async function stationsWithReservedWindows() {
  const stations = await prisma.chargingStation.findMany({
    include: {
      chargers: {
        include: {
          reservations: {
            where: {
              status: { in: ["PENDING", "CONFIRMED"] },
              endTime: { gt: new Date() }
            },
            select: { startTime: true, endTime: true },
            orderBy: { startTime: "asc" }
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return stations.map((station) => ({
    ...station,
    chargers: station.chargers.map((charger) => {
      const { reservations, ...chargerFields } = charger;
      return {
        ...chargerFields,
        reservedWindows: reservations.map((reservation) => ({
          startTime: reservation.startTime,
          endTime: reservation.endTime
        }))
      };
    })
  }));
}
