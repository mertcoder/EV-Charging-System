import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export async function seedDatabase(prisma: PrismaClient, options: { reset?: boolean } = {}) {
  if (options.reset) {
    await prisma.auditLog.deleteMany();
    await prisma.retentionPolicy.deleteMany();
    await prisma.failedLoginAttempt.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.favoriteStation.deleteMany();
    await prisma.issueReport.deleteMany();
    await prisma.chargingSession.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.charger.deleteMany();
    await prisma.chargingStation.deleteMany();
    await prisma.user.deleteMany();
  }

  const driver = await prisma.user.upsert({
    where: { email: "driver@group28.demo" },
    update: { name: "Demo EV Driver", role: "EV_DRIVER", isActive: true },
    create: { id: "user-driver", name: "Demo EV Driver", email: "driver@group28.demo", role: "EV_DRIVER" }
  });

  const secondDriver = await prisma.user.upsert({
    where: { email: "second.driver@group28.demo" },
    update: { name: "Second EV Driver", role: "EV_DRIVER", isActive: true },
    create: { id: "user-driver-2", name: "Second EV Driver", email: "second.driver@group28.demo", role: "EV_DRIVER" }
  });

  const operator = await prisma.user.upsert({
    where: { email: "operator@group28.demo" },
    update: { name: "Station Operator", role: "STATION_OPERATOR", isActive: true },
    create: { id: "user-operator", name: "Station Operator", email: "operator@group28.demo", role: "STATION_OPERATOR" }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@group28.demo" },
    update: { name: "Administrator", role: "ADMINISTRATOR", isActive: true },
    create: { id: "user-admin", name: "Administrator", email: "admin@group28.demo", role: "ADMINISTRATOR" }
  });

  await prisma.wallet.upsert({
    where: { userId: driver.id },
    update: {},
    create: { id: "wallet-driver", userId: driver.id, balanceCents: 50000 }
  });

  await prisma.wallet.upsert({
    where: { userId: secondDriver.id },
    update: {},
    create: { id: "wallet-driver-2", userId: secondDriver.id, balanceCents: 50000 }
  });

  await prisma.chargingStation.upsert({
    where: { id: "station-karsiyaka" },
    update: {
      name: "Karsiyaka Hub",
      address: "Karsiyaka, Izmir",
      latitude: 38.4557,
      longitude: 27.1136,
      operatingStart: "06:00",
      operatingEnd: "23:00",
      status: "AVAILABLE"
    },
    create: {
      id: "station-karsiyaka",
      name: "Karsiyaka Hub",
      address: "Karsiyaka, Izmir",
      latitude: 38.4557,
      longitude: 27.1136,
      operatingStart: "06:00",
      operatingEnd: "23:00",
      status: "AVAILABLE"
    }
  });

  await prisma.chargingStation.upsert({
    where: { id: "station-bornova" },
    update: {
      name: "Bornova Station",
      address: "Bornova, Izmir",
      latitude: 38.4622,
      longitude: 27.2177,
      operatingStart: "07:00",
      operatingEnd: "22:00",
      status: "AVAILABLE"
    },
    create: {
      id: "station-bornova",
      name: "Bornova Station",
      address: "Bornova, Izmir",
      latitude: 38.4622,
      longitude: 27.2177,
      operatingStart: "07:00",
      operatingEnd: "22:00",
      status: "AVAILABLE"
    }
  });

  await prisma.chargingStation.upsert({
    where: { id: "station-buca" },
    update: {
      name: "Buca Point",
      address: "Buca, Izmir",
      latitude: 38.3903,
      longitude: 27.1667,
      operatingStart: "08:00",
      operatingEnd: "21:00",
      status: "CLOSED"
    },
    create: {
      id: "station-buca",
      name: "Buca Point",
      address: "Buca, Izmir",
      latitude: 38.3903,
      longitude: 27.1667,
      operatingStart: "08:00",
      operatingEnd: "21:00",
      status: "CLOSED"
    }
  });

  const chargers = [
    { id: "charger-karsiyaka-ccs-03", stationId: "station-karsiyaka", code: "DC 50kW #03", chargerType: "DC", connectorType: "CCS", powerKw: 50, status: "AVAILABLE", pricePerKwhCents: 400 },
    { id: "charger-karsiyaka-type2-01", stationId: "station-karsiyaka", code: "AC 22kW #01", chargerType: "AC", connectorType: "TYPE_2", powerKw: 22, status: "AVAILABLE", pricePerKwhCents: 280 },
    { id: "charger-bornova-ccs-02", stationId: "station-bornova", code: "DC 150kW #02", chargerType: "DC", connectorType: "CCS", powerKw: 150, status: "IN_USE", pricePerKwhCents: 550 },
    { id: "charger-buca-chademo-01", stationId: "station-buca", code: "DC 50kW #01", chargerType: "DC", connectorType: "CHADEMO", powerKw: 50, status: "OUT_OF_SERVICE", pricePerKwhCents: 420 }
  ];

  for (const charger of chargers) {
    await prisma.charger.upsert({
      where: { id: charger.id },
      update: charger,
      create: charger
    });
  }

  await prisma.issueReport.upsert({
    where: { id: "issue-seeded-terminal" },
    update: { status: "OPEN" },
    create: {
      id: "issue-seeded-terminal",
      userId: driver.id,
      stationId: "station-bornova",
      category: "Payment terminal broken",
      description: "Seeded report used for operator workflow demonstration.",
      status: "OPEN"
    }
  });

  await prisma.notification.upsert({
    where: { id: "notification-demo" },
    update: {},
    create: {
      id: "notification-demo",
      userId: driver.id,
      type: "LOW_BALANCE",
      message: "Demo notification area is active; workflow events will appear here."
    }
  });

  await prisma.retentionPolicy.upsert({
    where: { entity: "Transaction" },
    update: { retentionYears: 5, description: "Financial transaction and receipt records are retained for five years." },
    create: { entity: "Transaction", retentionYears: 5, description: "Financial transaction and receipt records are retained for five years." }
  });

  await prisma.retentionPolicy.upsert({
    where: { entity: "AuditLog" },
    update: { retentionYears: 5, description: "Security and system audit records are retained for five years." },
    create: { entity: "AuditLog", retentionYears: 5, description: "Security and system audit records are retained for five years." }
  });

  const createdAt = new Date();
  const prevHash = "GENESIS";
  const details = `Seed data ready for ${driver.name}, ${operator.name}, and ${admin.name}.`;
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SEED_READY",
      entity: "Prototype",
      details,
      prevHash,
      entryHash: auditHash(prevHash, admin.id, "SEED_READY", "Prototype", undefined, details, createdAt),
      createdAt
    }
  });
}

function auditHash(prevHash: string, actorUserId: string | undefined, action: string, entity: string, entityId: string | undefined, details: string, createdAt: Date) {
  return createHash("sha256")
    .update([prevHash, actorUserId ?? "", action, entity, entityId ?? "", details, createdAt.toISOString()].join("|"))
    .digest("hex");
}
