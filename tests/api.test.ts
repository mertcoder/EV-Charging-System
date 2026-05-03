import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../server/app";
import { prisma } from "../server/db";
import { seedDatabase } from "../server/seedData";

beforeEach(async () => {
  await seedDatabase(prisma, { reset: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Group28 API workflows", () => {
  it("GET /api/bootstrap returns all 63 requirement mappings", async () => {
    const response = await request(app).get("/api/bootstrap").expect(200);

    expect(response.body.requirements).toHaveLength(63);
    expect(response.body.requirements.map((item: { id: string }) => item.id)).toContain("EDR-01");
    expect(response.body.requirements.map((item: { id: string }) => item.id)).toContain("SDR-05");
  });

  it("EDR-11 toggles a station favorite on and off", async () => {
    const added = await request(app)
      .post("/api/favorites")
      .send({ userId: "user-driver", stationId: "station-karsiyaka" })
      .expect(201);

    expect(added.body.stationId).toBe("station-karsiyaka");

    const removed = await request(app)
      .delete("/api/favorites")
      .send({ userId: "user-driver", stationId: "station-karsiyaka" })
      .expect(200);

    expect(removed.body.removed).toBe(true);

    const favorite = await prisma.favoriteStation.findUnique({
      where: { userId_stationId: { userId: "user-driver", stationId: "station-karsiyaka" } }
    });
    expect(favorite).toBeNull();
  });

  it("UC-1 registers the required Tesla Model 3 demo vehicle", async () => {
    const response = await request(app)
      .post("/api/vehicles")
      .send({
        userId: "user-driver",
        brand: "Tesla",
        modelName: "Model 3",
        batteryCapacityKwh: 75,
        connectorType: "CCS",
        plateNumber: "35 EV 2024"
      })
      .expect(201);

    expect(response.body.plateNumber).toBe("35 EV 2024");
  });

  it("SDR-01 scopes driver data to the selected account and blocks cross-user reservations", async () => {
    await createTeslaVehicle();
    const secondVehicle = await request(app)
      .post("/api/vehicles")
      .set("x-demo-role", "EV_DRIVER")
      .set("x-demo-user-id", "user-driver-2")
      .send({
        userId: "user-driver-2",
        brand: "Renault",
        modelName: "Megane E-Tech",
        batteryCapacityKwh: 60,
        connectorType: "CCS",
        plateNumber: "35 EV 2025"
      })
      .expect(201);

    const secondDriverBootstrap = await request(app)
      .get("/api/bootstrap")
      .set("x-demo-role", "EV_DRIVER")
      .set("x-demo-user-id", "user-driver-2")
      .expect(200);

    expect(secondDriverBootstrap.body.currentUser.id).toBe("user-driver-2");
    expect(secondDriverBootstrap.body.wallet.userId).toBe("user-driver-2");
    expect(secondDriverBootstrap.body.vehicles.map((vehicle: { id: string }) => vehicle.id)).toEqual([secondVehicle.body.id]);

    const firstDriverVehicle = await prisma.vehicle.findFirstOrThrow({ where: { userId: "user-driver" } });
    const startTime = reservationDemoStart();
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2);

    await request(app)
      .post("/api/reservations")
      .set("x-demo-role", "EV_DRIVER")
      .set("x-demo-user-id", "user-driver-2")
      .send({
        userId: "user-driver-2",
        vehicleId: firstDriverVehicle.id,
        chargerId: "charger-karsiyaka-ccs-03",
        startTime,
        endTime
      })
      .expect(403);
  });

  it("UC-2 creates a compatible reservation and route-ready record", async () => {
    const vehicle = await createTeslaVehicle();
    const startTime = reservationDemoStart();
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2);

    const response = await request(app)
      .post("/api/reservations")
      .send({
        userId: "user-driver",
        vehicleId: vehicle.id,
        chargerId: "charger-karsiyaka-ccs-03",
        startTime,
        endTime
      })
      .expect(201);

    expect(response.body.status).toBe("CONFIRMED");
    expect(response.body.charger.station.name).toBe("Karsiyaka Hub");
  });

  it("MNS-06 exposes reserved charger windows without leaking reservation PII", async () => {
    const reservation = await createReservation(60);

    const response = await request(app).get("/api/stations").expect(200);
    const station = response.body.find((item: { id: string }) => item.id === "station-karsiyaka");
    const charger = station.chargers.find((item: { id: string }) => item.id === "charger-karsiyaka-ccs-03");

    expect(charger.reservedWindows).toContainEqual({
      startTime: reservation.body.startTime,
      endTime: reservation.body.endTime
    });
    expect(charger).not.toHaveProperty("reservations");
    expect(JSON.stringify(charger)).not.toContain("user-driver");
    expect(JSON.stringify(charger)).not.toContain("35 EV 2024");
  });

  it("UC-3 completes charging and deducts 180 TL from wallet", async () => {
    const reservation = await createReservation();
    const started = await request(app)
      .post("/api/sessions/start")
      .send({ reservationId: reservation.body.id, startSoc: 20, targetSoc: 80 })
      .expect(201);

    const completed = await request(app).post(`/api/sessions/${started.body.id}/complete`).send({ endSoc: 80 }).expect(200);

    expect(completed.body.energyKwh).toBe(45);
    expect(completed.body.totalCost).toBe(180);
    expect(completed.body.receiptNumber).toMatch(/^CHG-/);
  });

  it("ADR-06 and SDR-02 block operator endpoint for an EV driver role", async () => {
    const response = await request(app)
      .patch("/api/operator/chargers/charger-karsiyaka-ccs-03/status")
      .set("x-demo-role", "EV_DRIVER")
      .send({ status: "OUT_OF_SERVICE" })
      .expect(403);

    expect(response.body.error).toContain("Unauthorized");
  });

  it("ADR-03 ADR-04 ADR-05 and ADR-08 return admin reports with utilization, peak hours and activity", async () => {
    const reservation = await createReservation();
    const started = await request(app).post("/api/sessions/start").send({ reservationId: reservation.body.id, startSoc: 20, targetSoc: 80 }).expect(201);
    await request(app).post(`/api/sessions/${started.body.id}/complete`).send({ endSoc: 80 }).expect(200);

    const response = await request(app)
      .get("/api/admin/reports")
      .set("x-demo-role", "ADMINISTRATOR")
      .set("x-demo-user-id", "user-admin")
      .expect(200);

    expect(response.body.revenue).toBeGreaterThanOrEqual(180);
    expect(response.body.utilization[0]).toHaveProperty("utilizationRate");
    expect(response.body.peakHours).toBeTypeOf("object");
    expect(response.body.userActivity).toHaveProperty("cancellations");
    expect(response.body.availabilityTarget).toContain("99.5%");
  });

  it("ADR-01 lets an administrator add and remove a station with a default charger", async () => {
    const created = await request(app)
      .post("/api/admin/stations")
      .set("x-demo-role", "ADMINISTRATOR")
      .set("x-demo-user-id", "user-admin")
      .send({
        name: "Test Admin Station",
        address: "Konak, Izmir",
        latitude: 38.4192,
        longitude: 27.1287,
        chargerCode: "DC 50kW #99",
        connectorType: "CCS",
        powerKw: 50,
        pricePerKwh: 4.4
      })
      .expect(201);

    expect(created.body.chargers).toHaveLength(1);
    expect(created.body.chargers[0].code).toBe("DC 50kW #99");

    await request(app)
      .delete(`/api/admin/stations/${created.body.id}`)
      .set("x-demo-role", "ADMINISTRATOR")
      .set("x-demo-user-id", "user-admin")
      .expect(200);
  });

  it("ADR-02 lets an administrator manage user roles and active state", async () => {
    const deactivated = await request(app)
      .patch("/api/admin/users/user-operator")
      .set("x-demo-role", "ADMINISTRATOR")
      .set("x-demo-user-id", "user-admin")
      .send({ isActive: false, role: "STATION_OPERATOR" })
      .expect(200);

    expect(deactivated.body.isActive).toBe(false);

    await request(app)
      .patch("/api/operator/chargers/charger-karsiyaka-ccs-03/status")
      .set("x-demo-role", "STATION_OPERATOR")
      .set("x-demo-user-id", "user-operator")
      .send({ status: "AVAILABLE" })
      .expect(403);

    const activated = await request(app)
      .patch("/api/admin/users/user-operator")
      .set("x-demo-role", "ADMINISTRATOR")
      .set("x-demo-user-id", "user-admin")
      .send({ isActive: true })
      .expect(200);

    expect(activated.body.isActive).toBe(true);
  });

  it("EDR-14 PWS-04 and EDR-16 support cancellation/refund and no-show actions", async () => {
    const cancellable = await createReservation();

    const cancelled = await request(app)
      .post(`/api/reservations/${cancellable.body.id}/cancel`)
      .expect(200);

    expect(cancelled.body.status).toBe("CANCELLED");
    expect(cancelled.body.refundAmount).toBe(400);
    const refund = await prisma.transaction.findFirst({ where: { type: "REFUND" }, orderBy: { createdAt: "desc" } });
    expect(refund?.amountCents).toBe(40000);
    expect(refund?.receiptNumber).toMatch(/^REF-/);

    const noShowCandidate = await createReservation();
    const noShow = await request(app)
      .post(`/api/reservations/${noShowCandidate.body.id}/no-show`)
      .expect(200);

    expect(noShow.body.status).toBe("NO_SHOW");
  });

  it("EDR-17 and EDR-18 auto-stop at target SoC and keep sync recovery trace", async () => {
    const reservation = await createReservation();

    const started = await request(app)
      .post("/api/sessions/start")
      .send({ reservationId: reservation.body.id, startSoc: 20, targetSoc: 60 })
      .expect(201);

    const synced = await request(app)
      .post(`/api/sessions/${started.body.id}/simulate-sync`)
      .expect(200);

    expect(synced.body.syncStatus).toContain("SYNCED");

    const completed = await request(app)
      .post(`/api/sessions/${started.body.id}/complete`)
      .send({ endSoc: 80 })
      .expect(200);

    expect(completed.body.endSoc).toBe(60);
    expect(completed.body.energyKwh).toBe(30);
  });

  it("PWS-08 safely interrupts charging when wallet balance is depleted mid-session", async () => {
    const reservation = await createReservation(30);

    const started = await request(app)
      .post("/api/sessions/start")
      .send({ reservationId: reservation.body.id, startSoc: 20, targetSoc: 80 })
      .expect(201);

    await prisma.wallet.update({ where: { userId: "user-driver" }, data: { balanceCents: 2000 } });

    const completed = await request(app)
      .post(`/api/sessions/${started.body.id}/complete`)
      .send({ endSoc: 80 })
      .expect(200);

    expect(completed.body.status).toBe("INTERRUPTED");
    expect(completed.body.totalCost).toBe(120);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: "user-driver" } });
    expect(wallet.balanceCents).toBe(0);

    const lowBalance = await prisma.notification.findFirst({ where: { userId: "user-driver", type: "LOW_BALANCE" }, orderBy: { createdAt: "desc" } });
    expect(lowBalance?.message).toContain("wallet balance depleted");
  });

  it("SOR-02 updates station info, hours and charger pricing", async () => {
    const station = await request(app)
      .patch("/api/operator/stations/station-karsiyaka")
      .set("x-demo-role", "STATION_OPERATOR")
      .set("x-demo-user-id", "user-operator")
      .send({ name: "Karsiyaka Hub Updated", address: "Karsiyaka Pier, Izmir", operatingStart: "06:30", operatingEnd: "22:30", status: "AVAILABLE" })
      .expect(200);

    expect(station.body.name).toBe("Karsiyaka Hub Updated");
    expect(station.body.address).toBe("Karsiyaka Pier, Izmir");
    expect(station.body.operatingStart).toBe("06:30");

    const charger = await request(app)
      .patch("/api/operator/chargers/charger-karsiyaka-ccs-03/status")
      .set("x-demo-role", "STATION_OPERATOR")
      .set("x-demo-user-id", "user-operator")
      .send({ status: "AVAILABLE", pricePerKwh: 4.25 })
      .expect(200);

    expect(charger.body.charger.pricePerKwh).toBe(4.25);
  });

  it("SDR-04 sends failed-login alerts to the administrator notification area", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app)
        .post("/api/security/simulate-failed-login")
        .send({ email: "driver@group28.demo" })
        .expect(200);
    }

    const bootstrap = await request(app)
      .get("/api/bootstrap")
      .set("x-demo-role", "ADMINISTRATOR")
      .set("x-demo-user-id", "user-admin")
      .expect(200);

    expect(bootstrap.body.notifications.some((notification: { type: string }) => notification.type === "SECURITY_ALERT")).toBe(true);
  });

  it("SOR-05 auto-cancels affected reservations when a charger goes out of service", async () => {
    const reservation = await createReservation();

    const response = await request(app)
      .patch("/api/operator/chargers/charger-karsiyaka-ccs-03/status")
      .set("x-demo-role", "STATION_OPERATOR")
      .set("x-demo-user-id", "user-operator")
      .send({ status: "OUT_OF_SERVICE", pricePerKwh: 4.25 })
      .expect(200);

    expect(response.body.affectedReservations).toBeGreaterThanOrEqual(1);

    const updated = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.body.id } });
    expect(updated.status).toBe("CANCELLED");
  });

  it("EDR-07 blocks incompatible charger reservation through the API", async () => {
    const vehicle = await createTeslaVehicle();
    const startTime = reservationDemoStart();
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 60);

    const response = await request(app)
      .post("/api/reservations")
      .send({
        userId: "user-driver",
        vehicleId: vehicle.id,
        chargerId: "charger-karsiyaka-type2-01",
        startTime,
        endTime
      })
      .expect(400);

    expect(response.body.errors.join(" ")).toContain("not compatible");
  });

  it("EDR-08 blocks reservations outside the 24h window and double bookings", async () => {
    const first = await createReservation(60);
    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { plateNumber: "35 EV 2024" } });

    await request(app)
      .post("/api/reservations")
      .send({
        userId: "user-driver",
        vehicleId: vehicle.id,
        chargerId: "charger-karsiyaka-ccs-03",
        startTime: first.body.startTime,
        endTime: first.body.endTime
      })
      .expect(400);

    const lateStart = new Date(Date.now() + 25 * 60 * 60 * 1000);
    lateStart.setMinutes(0, 0, 0);
    const lateEnd = new Date(lateStart);
    lateEnd.setMinutes(lateEnd.getMinutes() + 60);
    const outsideWindow = await request(app)
      .post("/api/reservations")
      .send({
        userId: "user-driver",
        vehicleId: vehicle.id,
        chargerId: "charger-karsiyaka-ccs-03",
        startTime: lateStart,
        endTime: lateEnd
      })
      .expect(400);

    expect(outsideWindow.body.errors.join(" ")).toContain("within 24 hours");
  });

  it("SDR-05 blocks wallet leaks, audit access, and admin reports for non-admin roles", async () => {
    await request(app)
      .post("/api/wallet/top-up")
      .set("x-demo-role", "EV_DRIVER")
      .set("x-demo-user-id", "user-driver-2")
      .send({ userId: "user-driver", amount: 50 })
      .expect(403);

    await request(app)
      .get("/api/audit")
      .set("x-demo-role", "EV_DRIVER")
      .set("x-demo-user-id", "user-driver")
      .expect(403);

    await request(app)
      .get("/api/admin/reports")
      .set("x-demo-role", "STATION_OPERATOR")
      .set("x-demo-user-id", "user-operator")
      .expect(403);

    await request(app)
      .get("/api/operator/reports")
      .set("x-demo-role", "STATION_OPERATOR")
      .set("x-demo-user-id", "user-operator")
      .expect(200);
  });

  it("ADR-07 keeps cents storage, notification isRead, duplicate charger guard, and valid audit hash chain", async () => {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: "user-driver" } });
    expect(wallet.balanceCents).toBe(50000);

    const notification = await prisma.notification.findFirstOrThrow({ where: { userId: "user-driver" } });
    expect(notification.isRead).toBe(false);

    await expect(
      prisma.charger.create({
        data: {
          stationId: "station-karsiyaka",
          code: "DC 50kW #03",
          chargerType: "DC",
          connectorType: "CCS",
          powerKw: 50,
          status: "AVAILABLE",
          pricePerKwhCents: 400
        }
      })
    ).rejects.toThrow();

    await request(app)
      .get("/api/audit")
      .set("x-demo-role", "ADMINISTRATOR")
      .set("x-demo-user-id", "user-admin")
      .expect(200)
      .expect((response) => {
        expect(response.body.chainValid).toBe(true);
        expect(response.body.rows[0]).toHaveProperty("entryHash");
      });
  });

  it("EDR-09 projects live charging and auto-stops old sessions at the 2-hour limit", async () => {
    const reservation = await createReservation();
    const started = await request(app).post("/api/sessions/start").send({ reservationId: reservation.body.id, startSoc: 20, targetSoc: 100 }).expect(201);
    await prisma.chargingSession.update({ where: { id: started.body.id }, data: { startTime: new Date(Date.now() - 3 * 60 * 60 * 1000) } });

    const projection = await request(app)
      .get(`/api/sessions/${started.body.id}/projection`)
      .set("x-demo-role", "EV_DRIVER")
      .set("x-demo-user-id", "user-driver")
      .expect(200);

    expect(projection.body.autoStopped).toBe(true);
    expect(projection.body.stopReason).toBe("TWO_HOUR_LIMIT");
  });
});

function reservationDemoStart() {
  const now = new Date();
  const startTime = new Date(now);
  if (now.getHours() < 6) {
    startTime.setHours(14, 0, 0, 0);
  } else if (now.getHours() <= 20) {
    startTime.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(14, 0, 0, 0);
  }
  return startTime;
}

async function createTeslaVehicle() {
  const existing = await prisma.vehicle.findUnique({ where: { plateNumber: "35 EV 2024" } });
  if (existing) return existing;

  return prisma.vehicle.create({
    data: {
      userId: "user-driver",
      brand: "Tesla",
      modelName: "Model 3",
      batteryCapacityKwh: 75,
      connectorType: "CCS",
      plateNumber: "35 EV 2024"
    }
  });
}

async function createReservation(durationMinutes = 120) {
  await createTeslaVehicle();
  await prisma.wallet.update({ where: { userId: "user-driver" }, data: { balanceCents: 100000 } });
  await prisma.charger.update({ where: { id: "charger-karsiyaka-ccs-03" }, data: { status: "AVAILABLE", pricePerKwhCents: 400 } });
  await prisma.chargingStation.update({ where: { id: "station-karsiyaka" }, data: { status: "AVAILABLE", operatingStart: "06:00", operatingEnd: "23:00" } });
  const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { plateNumber: "35 EV 2024" } });
  const startTime = reservationDemoStart();
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);

  return request(app)
    .post("/api/reservations")
    .send({
      userId: "user-driver",
      vehicleId: vehicle.id,
      chargerId: "charger-karsiyaka-ccs-03",
      startTime,
      endTime
    })
    .expect(201);
}
