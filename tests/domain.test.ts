import { describe, expect, it } from "vitest";
import {
  calculateSessionCost,
  estimateReservationCost,
  fromCents,
  isWithinOperatingHours,
  toCents,
  validateReservationRules,
  validateVehicleBusinessRules,
  vehicleInputSchema
} from "../server/domain";
import { demoOrigin, haversineDistanceKm } from "../src/shared/geo";
import { firstAvailableSlotIndex, isReservedSlot } from "../src/shared/reservationSlots";

describe("Group28 domain rules", () => {
  it("EDR-02 validates vehicle information and plate uniqueness", () => {
    const parsed = vehicleInputSchema.parse({
      userId: "user-driver",
      brand: "Tesla",
      modelName: "Model 3",
      batteryCapacityKwh: 75,
      connectorType: "CCS",
      plateNumber: "35 EV 2024"
    });

    expect(validateVehicleBusinessRules(parsed, [])).toEqual([]);
    expect(validateVehicleBusinessRules(parsed, ["35 EV 2024"])).toContain("A vehicle with this plate number is already registered.");
  });

  it("EDR-07 blocks incompatible charger reservation", () => {
    const now = new Date("2026-04-30T10:00:00");
    const startTime = new Date("2026-04-30T14:00:00");
    const endTime = new Date("2026-04-30T16:00:00");
    const estimatedCost = estimateReservationCost(50, 4, startTime, endTime);

    const errors = validateReservationRules({
      vehicleConnectorType: "CHADEMO",
      chargerConnectorType: "CCS",
      chargerStatus: "AVAILABLE",
      stationStatus: "AVAILABLE",
      stationOperatingStart: "06:00",
      stationOperatingEnd: "23:00",
      startTime,
      endTime,
      existingReservations: [],
      walletBalance: 500,
      estimatedCost,
      now
    });

    expect(errors.join(" ")).toContain("not compatible");
  });

  it("EDR-08 enforces max 2 hours, max 24 hours, operating hours and double-booking", () => {
    const now = new Date("2026-04-30T10:00:00");
    const startTime = new Date("2026-05-02T02:00:00");
    const endTime = new Date("2026-05-02T05:30:00");
    const errors = validateReservationRules({
      vehicleConnectorType: "CCS",
      chargerConnectorType: "CCS",
      chargerStatus: "AVAILABLE",
      stationStatus: "AVAILABLE",
      stationOperatingStart: "06:00",
      stationOperatingEnd: "23:00",
      startTime,
      endTime,
      existingReservations: [{ startTime: new Date("2026-05-02T03:00:00"), endTime: new Date("2026-05-02T04:00:00"), status: "CONFIRMED" }],
      walletBalance: 1000,
      estimatedCost: 700,
      now
    });

    expect(errors.join(" ")).toContain("Maximum session duration is 2 hours");
    expect(errors.join(" ")).toContain("within 24 hours");
    expect(errors.join(" ")).toContain("operating hours");
    expect(errors.join(" ")).toContain("already reserved");
  });

  it("UC-3 calculates 45 kWh x 4 TL = 180 TL for the required demo", () => {
    expect(calculateSessionCost(75, 20, 80, 4)).toEqual({
      consumedKwh: 45,
      totalCost: 180
    });
  });

  it("BUG_REPORT_V1 stores money as cents and supports midnight operating hours", () => {
    expect(toCents(4.25)).toBe(425);
    expect(fromCents(425)).toBe(4.25);
    expect(isWithinOperatingHours(new Date("2026-05-01T23:30:00"), new Date("2026-05-02T00:30:00"), "22:00", "02:00")).toBe(true);
    expect(isWithinOperatingHours(new Date("2026-05-01T10:00:00"), new Date("2026-05-01T11:00:00"), "00:00", "00:00")).toBe(true);
  });

  it("MNS-04 calculates Haversine distance from live or fallback origin", () => {
    const distance = haversineDistanceKm(demoOrigin, { latitude: 38.4557, longitude: 27.1136 });
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(10);
  });

  it("MNS-06 marks reserved slots disabled and chooses the first available slot", () => {
    const reservedWindows = [{ startTime: "2026-05-03T10:00:00.000Z", endTime: "2026-05-03T11:00:00.000Z" }];

    expect(isReservedSlot(new Date("2026-05-03T10:30:00.000Z"), new Date("2026-05-03T11:00:00.000Z"), reservedWindows)).toBe(true);
    expect(isReservedSlot(new Date("2026-05-03T11:00:00.000Z"), new Date("2026-05-03T11:30:00.000Z"), reservedWindows)).toBe(false);
    expect(firstAvailableSlotIndex([
      { start: new Date("2026-05-03T10:00:00.000Z"), end: new Date("2026-05-03T10:30:00.000Z"), isReserved: true },
      { start: new Date("2026-05-03T11:00:00.000Z"), end: new Date("2026-05-03T11:30:00.000Z"), isReserved: false }
    ])).toBe(1);
  });
});
