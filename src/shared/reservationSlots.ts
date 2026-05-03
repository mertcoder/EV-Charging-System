import type { ReservedWindow } from "./domain";

export interface ReservableSlot {
  start: Date;
  end: Date;
  isReserved: boolean;
}

export function isReservedSlot(start: Date, end: Date, reservedWindows: ReservedWindow[] = []) {
  return reservedWindows.some((window) => {
    const reservedStart = new Date(window.startTime);
    const reservedEnd = new Date(window.endTime);
    return start < reservedEnd && end > reservedStart;
  });
}

export function firstAvailableSlotIndex<T extends ReservableSlot>(slots: T[]) {
  return slots.findIndex((slot) => !slot.isReserved);
}
