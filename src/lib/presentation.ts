import type { Charger, ChargingStation } from "../shared/domain";
import type { Coordinates } from "../shared/geo";
import { isReservedSlot } from "../shared/reservationSlots";
import type { ViewId } from "../appTypes";

export function titleFor(view: ViewId) {
  return {
    vehicle: "My EV",
    reserve: "Find a charging station",
    charge: "Charging session",
    wallet: "Wallet",
    ops: "Operations center",
    evidence: "Activity and system"
  }[view];
}

export function subtitleFor(view: ViewId) {
  return {
    vehicle: "Manage your registered electric vehicles",
    reserve: "View and reserve nearby available stations",
    charge: "Track the active session live",
    wallet: "Balance, top-ups, and transaction history",
    ops: "Station, charger, and issue management",
    evidence: "System health and audit records"
  }[view];
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "Active",
    COMPLETED: "Completed",
    INTERRUPTED: "Interrupted",
    FAILED: "Failed"
  };
  return map[status] ?? status;
}

export function transactionLabel(type: string) {
  const map: Record<string, string> = {
    TOP_UP: "Top-up",
    HOLD: "Reservation hold",
    CHARGE: "Charging fee",
    REFUND: "Refund"
  };
  return map[type] ?? type;
}

export function stationAvailability(station: ChargingStation) {
  if (station.status !== "AVAILABLE") return "Offline";
  if (station.chargers.some((charger) => charger.status === "AVAILABLE")) return "Available";
  if (station.chargers.some((charger) => charger.status === "IN_USE" || charger.status === "RESERVED")) return "Occupied";
  return "Offline";
}

export function money(value: number) {
  return `${Number(value).toFixed(2)} TL`;
}

export function googleMapsDirectionsUrl(station: ChargingStation, origin: Coordinates) {
  const originPoint = encodeURIComponent(`${origin.latitude},${origin.longitude}`);
  const destination = encodeURIComponent(`${station.latitude},${station.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&origin=${originPoint}&destination=${destination}&travelmode=driving`;
}

export function timeShort(value: string) {
  return new Date(value).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export interface Slot {
  start: Date;
  end: Date;
  label: string;
  dayLabel: string;
  timeLabel: string;
  durationHours: number;
  isReserved: boolean;
}

export function buildSlots(station?: ChargingStation, durationMinutes = 120, reservedWindows: Charger["reservedWindows"] = []): Slot[] {
  const now = new Date();
  const open = parseClock(station?.operatingStart ?? "06:00");
  const closeRaw = parseClock(station?.operatingEnd ?? "23:00");
  const close = closeRaw <= open ? closeRaw + 24 * 60 : closeRaw;
  const slots: Slot[] = [];
  const durationHours = durationMinutes / 60;

  for (let dayOffset = 0; dayOffset <= 1 && slots.length < 8; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    for (let minutes = open; minutes + durationMinutes <= close && slots.length < 8; minutes += 30) {
      const start = new Date(day);
      start.setHours(Math.floor((minutes % (24 * 60)) / 60), minutes % 60, 0, 0);
      if (minutes >= 24 * 60) start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + durationMinutes);
      if (start.getTime() <= now.getTime()) continue;
      if (start.getTime() - now.getTime() > 24 * 60 * 60 * 1000) continue;
      const dayLabel = start.toDateString() === now.toDateString() ? "Today" : "Tomorrow";
      const timeLabel = `${clock(start)}-${clock(end)}`;
      slots.push({ start, end, dayLabel, timeLabel, label: `${dayLabel} ${timeLabel}`, durationHours, isReserved: isReservedSlot(start, end, reservedWindows) });
    }
  }

  if (slots.length === 0) {
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(14, 0, 0, 0);
    const end = new Date(fallback);
    end.setMinutes(end.getMinutes() + durationMinutes);
    slots.push({
      start: fallback,
      end,
      dayLabel: "Tomorrow",
      timeLabel: `${clock(fallback)}-${clock(end)}`,
      label: `Tomorrow ${clock(fallback)}-${clock(end)}`,
      durationHours,
      isReserved: isReservedSlot(fallback, end, reservedWindows)
    });
  }

  return slots;
}

function parseClock(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function clock(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
