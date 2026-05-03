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
export function registerSystemRoutes(app: Express) {
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Group28 EV Charging Prototype API" });
});

app.post("/api/dev/seed", async (_req, res, next) => {
  try {
    await seedDatabase(prisma, { reset: true });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", async (req, res, next) => {
  try {
    const usersCount = await prisma.user.count();
    if (usersCount === 0) {
      await seedDatabase(prisma);
    }
    await sweepNoShows();

    const role = roleFromRequest(req);
    const requestedUserId = userIdFromRequest(req);
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    const currentUser = users.find((user) => user.id === requestedUserId && user.role === role && user.isActive) ?? users.find((user) => user.role === role && user.isActive) ?? users[0];
    const isDriver = currentUser.role === "EV_DRIVER";
    const wallet = isDriver
      ? await prisma.wallet.findUnique({
          where: { userId: currentUser.id },
          include: { transactions: { orderBy: { createdAt: "desc" } } }
        })
      : null;
    const userScope = isDriver ? { userId: currentUser.id } : {};

    const [vehicles, stations, reservations, sessions, issues, notifications, favorites, auditRows] = await Promise.all([
      prisma.vehicle.findMany({ where: userScope, orderBy: { createdAt: "desc" } }),
      stationsWithReservedWindows(),
      prisma.reservation.findMany({
        where: userScope,
        include: { vehicle: true, charger: { include: { station: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.chargingSession.findMany({
        where: userScope,
        include: { reservation: { include: { vehicle: true, charger: { include: { station: true } } } } },
        orderBy: { startTime: "desc" }
      }),
      prisma.issueReport.findMany({ where: userScope, include: { station: { include: { chargers: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.notification.findMany({ where: { userId: currentUser.id }, orderBy: { createdAt: "desc" } }),
      isDriver ? prisma.favoriteStation.findMany({ where: { userId: currentUser.id }, include: { station: { include: { chargers: true } } }, orderBy: { addedAt: "desc" } }) : Promise.resolve([]),
      currentUser.role === "ADMINISTRATOR" ? prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 }) : Promise.resolve([])
    ]);

    res.json({
      users,
      currentUser,
      vehicles,
      wallet,
      stations,
      reservations,
      sessions,
      issues,
      notifications,
      favorites,
      audit: auditRows,
      requirements
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/stations", async (req, res, next) => {
  try {
    const connector = String(req.query.connector ?? "");
    const power = Number(req.query.power ?? 0);
    const maxPrice = Number(req.query.maxPrice ?? 0);

    const stations = await stationsWithReservedWindows();

    const filtered = stations
      .map((station) => ({
        ...station,
        chargers: station.chargers.filter((charger) => {
          if (connector && charger.connectorType !== connector) return false;
          if (power && charger.powerKw !== power) return false;
          if (maxPrice && fromCents(charger.pricePerKwhCents) > maxPrice) return false;
          return true;
        })
      }))
      .filter((station) => station.chargers.length > 0);

    res.json(filtered);
  } catch (error) {
    next(error);
  }
});
}

