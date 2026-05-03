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
export function registerFavoriteRoutes(app: Express) {
app.post("/api/favorites", async (req, res, next) => {
  try {
    const parsed = z.object({ userId: z.string(), stationId: z.string() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: parsed.data.userId });
    if (!actor) return;
    const favorite = await prisma.favoriteStation.upsert({
      where: { userId_stationId: parsed.data },
      update: {},
      create: parsed.data,
      include: { station: { include: { chargers: true } } }
    });
    await audit(parsed.data.userId, "FAVORITE_STATION_SAVED", "FavoriteStation", favorite.id, favorite.station.name);
    res.status(201).json(favorite);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/favorites", async (req, res, next) => {
  try {
    const parsed = z.object({ userId: z.string(), stationId: z.string() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const actor = await authorizeRequest(req, res, { role: "EV_DRIVER", userId: parsed.data.userId });
    if (!actor) return;

    const favorite = await prisma.favoriteStation.findUnique({
      where: { userId_stationId: parsed.data },
      include: { station: { include: { chargers: true } } }
    });

    if (!favorite) {
      res.status(404).json({ error: "Favorite station not found." });
      return;
    }

    await prisma.favoriteStation.delete({ where: { id: favorite.id } });
    await audit(parsed.data.userId, "FAVORITE_STATION_REMOVED", "FavoriteStation", favorite.id, favorite.station.name);
    res.json({ removed: true, favorite });
  } catch (error) {
    next(error);
  }
});
}

