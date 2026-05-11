import type { AuditLog, ChargingStation } from "./shared/domain";

export type ViewId = "vehicle" | "reserve" | "charge" | "wallet" | "ops" | "evidence" | "help";
export type StationDraft = Pick<ChargingStation, "name" | "address" | "operatingStart" | "operatingEnd" | "status">;
export type StationFormState = {
  mode: "new" | "existing";
  existingStationId: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  operatingStart: string;
  operatingEnd: string;
  chargerCode: string;
  chargerType: string;
  connectorType: string;
  powerKw: string;
  pricePerKwh: string;
};
export type ReportsPayload = {
  revenue: number;
  utilization: Array<{ stationId: string; stationName: string; sessions: number; chargers: number; utilizationRate: number }>;
  peakHours: Record<string, number>;
  chargerStatus: Record<string, number>;
  issueStatus: Record<string, number>;
  recentAudit: AuditLog[];
  userActivity: {
    users: number;
    reservations: number;
    cancellations: number;
    noShows: number;
    completedSessions: number;
    interruptedSessions: number;
    maintenanceIssues: number;
  };
  availabilityTarget: string;
};
export type NavSection = "drive" | "operate" | "system" | "support";
