export const connectorTypes = ["TYPE_2", "CCS", "CHADEMO"] as const;
export const chargerTypes = ["AC", "DC"] as const;
export const chargerStatuses = ["AVAILABLE", "IN_USE", "RESERVED", "OUT_OF_SERVICE"] as const;
export const reservationStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;
export const sessionStatuses = ["ACTIVE", "COMPLETED", "INTERRUPTED"] as const;
export const userRoles = ["EV_DRIVER", "STATION_OPERATOR", "ADMINISTRATOR"] as const;

export type ConnectorType = (typeof connectorTypes)[number];
export type ChargerType = (typeof chargerTypes)[number];
export type ChargerStatus = (typeof chargerStatuses)[number];
export type ReservationStatus = (typeof reservationStatuses)[number];
export type SessionStatus = (typeof sessionStatuses)[number];
export type UserRole = (typeof userRoles)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface Vehicle {
  id: string;
  userId: string;
  brand: string;
  modelName: string;
  batteryCapacityKwh: number;
  connectorType: ConnectorType;
  plateNumber: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  transactions?: Transaction[];
}

export interface Transaction {
  id: string;
  walletId: string;
  type: "TOP_UP" | "HOLD" | "CHARGE" | "REFUND";
  amount: number;
  description: string;
  receiptNumber?: string | null;
  createdAt: string;
}

export interface ChargingStation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingStart: string;
  operatingEnd: string;
  status: "AVAILABLE" | "MAINTENANCE" | "CLOSED";
  chargers: Charger[];
}

export interface ReservedWindow {
  startTime: string;
  endTime: string;
}

export interface Charger {
  id: string;
  stationId: string;
  code: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerKw: number;
  status: ChargerStatus;
  pricePerKwh: number;
  reservedWindows?: ReservedWindow[];
}

export interface Reservation {
  id: string;
  userId: string;
  vehicleId: string;
  chargerId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  estimatedCost: number;
  holdAmount: number;
  refundAmount: number;
  charger?: Charger & { station?: ChargingStation };
  vehicle?: Vehicle;
}

export interface ChargingSession {
  id: string;
  reservationId: string;
  userId: string;
  chargerId: string;
  startTime: string;
  endTime?: string | null;
  startSoc: number;
  endSoc?: number | null;
  targetSoc?: number | null;
  energyKwh: number;
  unitPrice: number;
  totalCost: number;
  status: SessionStatus;
  receiptNumber?: string | null;
  syncStatus: string;
  reservation?: Reservation & { vehicle?: Vehicle; charger?: Charger & { station?: ChargingStation } };
}

export interface IssueReport {
  id: string;
  userId: string;
  stationId: string;
  category: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  station?: ChargingStation;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface FavoriteStation {
  id: string;
  userId: string;
  stationId: string;
  addedAt: string;
  station?: ChargingStation;
}

export interface AuditLog {
  id: string;
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details: string;
  prevHash: string;
  entryHash: string;
  createdAt: string;
}

export interface RequirementCoverage {
  id: string;
  viewpoint: string;
  summary: string;
  module: string;
  ui: string;
  api: string;
  db: string;
  tests: string;
  status: "Implemented" | "Prototype" | "Documented";
}

export interface BootstrapPayload {
  users: User[];
  currentUser: User;
  vehicles: Vehicle[];
  wallet: Wallet | null;
  stations: ChargingStation[];
  reservations: Reservation[];
  sessions: ChargingSession[];
  issues: IssueReport[];
  notifications: Notification[];
  favorites: FavoriteStation[];
  audit: AuditLog[];
  requirements: RequirementCoverage[];
}
