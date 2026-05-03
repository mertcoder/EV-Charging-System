import { z } from "zod";
import { connectorTypes } from "../src/shared/domain";

export const vehicleInputSchema = z.object({
  userId: z.string().min(1),
  brand: z.string().trim().min(1, "Brand is required"),
  modelName: z.string().trim().min(1, "Model is required"),
  batteryCapacityKwh: z.coerce.number().min(1, "Battery capacity must be between 1 and 200 kWh").max(200, "Battery capacity must be between 1 and 200 kWh"),
  connectorType: z.enum(connectorTypes),
  plateNumber: z.string().trim().min(1, "Plate number is required")
});

export const reservationInputSchema = z.object({
  userId: z.string().min(1),
  vehicleId: z.string().min(1),
  chargerId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date()
});

export const sessionStartSchema = z.object({
  reservationId: z.string().min(1),
  startSoc: z.coerce.number().min(0).max(100).default(20),
  targetSoc: z.coerce.number().min(1).max(100).optional()
});

export const sessionCompleteSchema = z.object({
  endSoc: z.coerce.number().min(0).max(100).optional(),
  simulateConnectivityLoss: z.boolean().optional(),
  simulateChargerMalfunction: z.boolean().optional()
});

export function normalizePlate(plateNumber: string) {
  return plateNumber.trim().replace(/\s+/g, " ").toUpperCase();
}

export function isValidTurkishPlate(plateNumber: string) {
  return /^\d{2}\s[A-Z]{1,3}\s\d{2,4}$/.test(normalizePlate(plateNumber));
}

export function validateVehicleBusinessRules(input: z.infer<typeof vehicleInputSchema>, existingPlateNumbers: string[]) {
  const errors: string[] = [];
  const plateNumber = normalizePlate(input.plateNumber);

  if (!isValidTurkishPlate(plateNumber)) {
    errors.push("Invalid plate number format.");
  }

  if (existingPlateNumbers.map(normalizePlate).includes(plateNumber)) {
    errors.push("A vehicle with this plate number is already registered.");
  }

  return errors;
}

export interface ReservationRuleInput {
  vehicleConnectorType: string;
  chargerConnectorType: string;
  chargerStatus: string;
  stationStatus: string;
  stationOperatingStart: string;
  stationOperatingEnd: string;
  startTime: Date;
  endTime: Date;
  existingReservations: Array<{ startTime: Date; endTime: Date; status: string }>;
  walletBalance: number;
  estimatedCost: number;
  now?: Date;
}

export function hoursBetween(startTime: Date, endTime: Date) {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
}

export function estimateReservationCost(powerKw: number, pricePerKwh: number, startTime: Date, endTime: Date) {
  const durationHours = Math.max(0, hoursBetween(startTime, endTime));
  return roundMoney(powerKw * durationHours * pricePerKwh);
}

export function toCents(value: number) {
  return Math.round(Number(value) * 100);
}

export function fromCents(value: number) {
  return roundMoney(Number(value) / 100);
}

export function validateReservationRules(input: ReservationRuleInput) {
  const errors: string[] = [];
  const now = input.now ?? new Date();
  const durationHours = hoursBetween(input.startTime, input.endTime);

  if (input.vehicleConnectorType !== input.chargerConnectorType) {
    errors.push(`Your vehicle's connector (${input.vehicleConnectorType}) is not compatible with this charger (${input.chargerConnectorType}).`);
  }

  if (input.stationStatus !== "AVAILABLE" || input.chargerStatus === "OUT_OF_SERVICE") {
    errors.push("This station or charger is currently offline. Please select another station.");
  }

  if (input.chargerStatus === "IN_USE") {
    errors.push("This charger is currently occupied. Please select another charger.");
  }

  if (durationHours <= 0) {
    errors.push("Reservation end time must be after start time.");
  }

  if (durationHours > 2) {
    errors.push("Maximum session duration is 2 hours. Please adjust your time slot.");
  }

  if (input.startTime.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
    errors.push("Reservations can only be made within 24 hours of the desired time.");
  }

  if (!isWithinOperatingHours(input.startTime, input.endTime, input.stationOperatingStart, input.stationOperatingEnd)) {
    errors.push(`Selected slot must be within station operating hours (${input.stationOperatingStart}-${input.stationOperatingEnd}).`);
  }

  const overlaps = input.existingReservations.some((reservation) => {
    if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
      return false;
    }
    return input.startTime < reservation.endTime && input.endTime > reservation.startTime;
  });

  if (overlaps) {
    errors.push("This time slot is already reserved. Please select a different time.");
  }

  if (input.walletBalance < input.estimatedCost) {
    errors.push(`Your wallet balance (${roundMoney(input.walletBalance)} TL) is insufficient for the estimated cost (${input.estimatedCost} TL). Please top up your wallet.`);
  }

  return errors;
}

export function isWithinOperatingHours(startTime: Date, endTime: Date, operatingStart: string, operatingEnd: string) {
  const startMinutes = minutesOfDay(startTime);
  const durationMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60));
  const endMinutes = startMinutes + durationMinutes;
  const openMinutes = parseClock(operatingStart);
  const closeMinutes = parseClock(operatingEnd);

  if (openMinutes === closeMinutes) {
    return true;
  }

  if (closeMinutes > openMinutes) {
    return startMinutes >= openMinutes && endMinutes <= closeMinutes;
  }

  const normalizedStart = startMinutes < openMinutes ? startMinutes + 24 * 60 : startMinutes;
  const normalizedClose = closeMinutes + 24 * 60;
  return normalizedStart >= openMinutes && normalizedStart + durationMinutes <= normalizedClose;
}

export function parseClock(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesOfDay(value: Date) {
  return value.getHours() * 60 + value.getMinutes();
}

export function calculateSessionCost(batteryCapacityKwh: number, startSoc: number, endSoc: number, unitPrice: number) {
  const consumedKwh = Math.max(0, ((endSoc - startSoc) / 100) * batteryCapacityKwh);
  return {
    consumedKwh: roundEnergy(consumedKwh),
    totalCost: roundMoney(consumedKwh * unitPrice)
  };
}

export function roundEnergy(value: number) {
  return Math.round(value * 10) / 10;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function receiptNumber(prefix: "TOP" | "CHG" | "REF") {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.floor(Math.random() * 900 + 100)}`;
}
