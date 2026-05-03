import { fromCents } from "../domain";
import { prisma } from "../db";

export async function buildReports(includeAudit: boolean) {
  const [sessions, reservations, issues, users, chargers, stations, auditRows] = await Promise.all([
    prisma.chargingSession.findMany({ include: { charger: { include: { station: true } } } }),
    prisma.reservation.findMany(),
    prisma.issueReport.findMany(),
    prisma.user.findMany(),
    prisma.charger.findMany({ include: { station: true } }),
    prisma.chargingStation.findMany({ include: { chargers: true } }),
    includeAudit ? prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }) : Promise.resolve([])
  ]);

  const revenue = fromCents(sessions.reduce((sum, session) => sum + session.totalCostCents, 0));
  const utilization = stations.map((station) => {
    const sessionCount = sessions.filter((session) => session.charger.stationId === station.id).length;
    const chargerCount = Math.max(station.chargers.length, 1);
    return {
      stationId: station.id,
      stationName: station.name,
      sessions: sessionCount,
      chargers: station.chargers.length,
      utilizationRate: Math.round((sessionCount / chargerCount) * 100)
    };
  });
  const peakHours = sessions.reduce<Record<string, number>>((acc, session) => {
    const hour = new Date(session.startTime).getHours().toString().padStart(2, "0") + ":00";
    acc[hour] = (acc[hour] ?? 0) + 1;
    return acc;
  }, {});
  const chargerStatus = chargers.reduce<Record<string, number>>((acc, charger) => {
    acc[charger.status] = (acc[charger.status] ?? 0) + 1;
    return acc;
  }, {});
  const issueStatus = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.status] = (acc[issue.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    revenue,
    utilization,
    peakHours,
    chargerStatus,
    issueStatus,
    recentAudit: auditRows,
    userActivity: includeAudit
      ? {
          users: users.length,
          reservations: reservations.length,
          cancellations: reservations.filter((reservation) => reservation.status === "CANCELLED").length,
          noShows: reservations.filter((reservation) => reservation.status === "NO_SHOW").length,
          completedSessions: sessions.filter((session) => session.status === "COMPLETED").length,
          interruptedSessions: sessions.filter((session) => session.status === "INTERRUPTED").length,
          maintenanceIssues: issues.filter((issue) => issue.status !== "RESOLVED").length
        }
      : {
          users: 0,
          reservations: reservations.length,
          cancellations: reservations.filter((reservation) => reservation.status === "CANCELLED").length,
          noShows: reservations.filter((reservation) => reservation.status === "NO_SHOW").length,
          completedSessions: sessions.filter((session) => session.status === "COMPLETED").length,
          interruptedSessions: sessions.filter((session) => session.status === "INTERRUPTED").length,
          maintenanceIssues: issues.filter((issue) => issue.status !== "RESOLVED").length
        },
    availabilityTarget: "99.5% monthly availability excluding scheduled maintenance"
  };
}
