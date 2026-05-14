import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = resolve("prisma", "dev.db");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = OFF;");

const drops = [
  "AuditLog",
  "RetentionPolicy",
  "FailedLoginAttempt",
  "Notification",
  "FavoriteStation",
  "IssueReport",
  "ChargingSession",
  "Reservation",
  "Transaction",
  "Wallet",
  "Vehicle",
  "Charger",
  "ChargingStation",
  "User"
];

for (const table of drops) {
  db.exec(`DROP TABLE IF EXISTS "${table}";`);
}

db.exec("PRAGMA foreign_keys = ON;");

const statements = [
  `CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "batteryCapacityKwh" REAL NOT NULL,
    "connectorType" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL UNIQUE,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE INDEX "Transaction_walletId_createdAt_idx" ON "Transaction" ("walletId", "createdAt");`,
  `CREATE TABLE "ChargingStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "operatingStart" TEXT NOT NULL,
    "operatingEnd" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE "Charger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "chargerType" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "powerKw" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "pricePerKwhCents" INTEGER NOT NULL,
    CONSTRAINT "Charger_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE UNIQUE INDEX "Charger_stationId_code_key" ON "Charger" ("stationId", "code");`,
  `CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "chargerId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL,
    "holdAmountCents" INTEGER NOT NULL DEFAULT 0,
    "refundAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "noShowAt" DATETIME,
    CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE INDEX "Reservation_chargerId_status_startTime_idx" ON "Reservation" ("chargerId", "status", "startTime");`,
  `CREATE TABLE "ChargingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "chargerId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "startSoc" REAL NOT NULL,
    "endSoc" REAL,
    "targetSoc" REAL,
    "energyKwh" REAL NOT NULL DEFAULT 0,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    CONSTRAINT "ChargingSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChargingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChargingSession_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE INDEX "ChargingSession_userId_idx" ON "ChargingSession" ("userId");`,
  `CREATE TABLE "IssueReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueReport_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");`,
  `CREATE TABLE "FavoriteStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteStation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FavoriteStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE UNIQUE INDEX "FavoriteStation_userId_stationId_key" ON "FavoriteStation" ("userId", "stationId");`,
  `CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "entryHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );`,
  `CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");`,
  `CREATE TABLE "FailedLoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" DATETIME
  );`,
  `CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL UNIQUE,
    "retentionYears" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`
];

for (const statement of statements) {
  db.exec(statement);
}

db.close();
console.log(`SQLite schema initialized at ${dbPath}`);
