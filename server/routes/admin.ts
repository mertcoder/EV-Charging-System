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
export function registerAdminRoutes(app: Express) {
app.post("/api/admin/stations", requireRole(["ADMINISTRATOR"]), async (req, res, next) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(1, "Station name is required."),
      address: z.string().trim().min(1, "Address is required."),
      latitude: z.coerce.number(),
      longitude: z.coerce.number(),
      operatingStart: z.string().default("08:00"),
      operatingEnd: z.string().default("22:00"),
      chargerCode: z.string().trim().min(1).optional(),
      chargerType: z.enum(["AC", "DC"]).default("DC"),
      connectorType: z.enum(["TYPE_2", "CCS", "CHADEMO"]).default("CCS"),
      powerKw: z.coerce.number().int().positive().default(50),
      pricePerKwh: z.coerce.number().positive().default(4)
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const normalizedName = parsed.data.name.replace(/\s+/g, " ").trim();
    const compareKey = normalizedName.toLowerCase();
    const allStations = await prisma.chargingStation.findMany({ select: { name: true } });
    const duplicate = allStations.find((station) => station.name.trim().toLowerCase() === compareKey);
    if (duplicate) {
      res.status(400).json({ errors: [`A station named "${duplicate.name}" already exists. Use a unique name or add a charger to the existing station instead.`] });
      return;
    }
    const station = await prisma.chargingStation.create({
      data: {
        name: normalizedName,
        address: parsed.data.address,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        operatingStart: parsed.data.operatingStart,
        operatingEnd: parsed.data.operatingEnd,
        status: "AVAILABLE",
        chargers: {
          create: {
            code: parsed.data.chargerCode ?? `${parsed.data.chargerType} ${parsed.data.powerKw}kW #01`,
            chargerType: parsed.data.chargerType,
            connectorType: parsed.data.connectorType,
            powerKw: parsed.data.powerKw,
            status: "AVAILABLE",
            pricePerKwhCents: toCents(parsed.data.pricePerKwh)
          }
        }
      },
      include: { chargers: true }
    });
    await audit(userIdFromRequest(req), "STATION_ADDED", "ChargingStation", station.id, station.name);
    res.status(201).json(station);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/stations/:id/chargers", requireRole(["ADMINISTRATOR"]), async (req, res, next) => {
  try {
    const parsed = z.object({
      chargerCode: z.string().trim().min(1, "Charger code is required.").optional(),
      chargerType: z.enum(["AC", "DC"]).default("DC"),
      connectorType: z.enum(["TYPE_2", "CCS", "CHADEMO"]).default("CCS"),
      powerKw: z.coerce.number().int().positive("Power must be a positive integer.").default(50),
      pricePerKwh: z.coerce.number().positive("Price must be greater than zero.").default(4)
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const stationId = routeParam(req, "id");
    const station = await prisma.chargingStation.findUnique({ where: { id: stationId } });
    if (!station) {
      res.status(404).json({ errors: ["Station not found."] });
      return;
    }
    const existingCount = await prisma.charger.count({ where: { stationId } });
    const code = parsed.data.chargerCode ?? `${parsed.data.chargerType} ${parsed.data.powerKw}kW #${String(existingCount + 1).padStart(2, "0")}`;
    const duplicate = await prisma.charger.findUnique({ where: { stationId_code: { stationId, code } } }).catch(() => null);
    if (duplicate) {
      res.status(400).json({ errors: [`A charger with code "${code}" already exists at this station.`] });
      return;
    }
    const charger = await prisma.charger.create({
      data: {
        stationId,
        code,
        chargerType: parsed.data.chargerType,
        connectorType: parsed.data.connectorType,
        powerKw: parsed.data.powerKw,
        status: "AVAILABLE",
        pricePerKwhCents: toCents(parsed.data.pricePerKwh)
      }
    });
    await audit(userIdFromRequest(req), "CHARGER_ADDED", "Charger", charger.id, `${charger.code} added to ${station.name}.`);
    res.status(201).json(charger);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/stations/:id", requireRole(["ADMINISTRATOR"]), async (req, res, next) => {
  try {
    const station = await prisma.chargingStation.delete({ where: { id: routeParam(req, "id") } });
    await audit(userIdFromRequest(req), "STATION_REMOVED", "ChargingStation", station.id, station.name);
    res.json(station);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/users/:id", requireRole(["ADMINISTRATOR"]), async (req, res, next) => {
  try {
    const parsed = z.object({ isActive: z.boolean().optional(), role: z.enum(["EV_DRIVER", "STATION_OPERATOR", "ADMINISTRATOR"]).optional() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: formatZodError(parsed.error) });
      return;
    }
    const user = await prisma.user.update({ where: { id: routeParam(req, "id") }, data: parsed.data });
    await audit(userIdFromRequest(req), "USER_ACCOUNT_UPDATED", "User", user.id, `${user.email} updated.`);
    res.json(user);
  } catch (error) {
    next(error);
  }
});
}

