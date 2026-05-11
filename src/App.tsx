import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Car,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Gauge,
  History,
  Lock,
  LogOut,
  MapPinned,
  Moon,
  Navigation,
  Plus,
  PlugZap,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  UserCircle,
  UserCog,
  WalletCards,
  Wrench,
  Zap
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type {
  AuditLog,
  BootstrapPayload,
  Charger,
  ChargerStatus,
  ChargingSession,
  ChargingStation,
  IssueReport,
  Reservation,
  User,
  UserRole,
  Vehicle
} from "./shared/domain";
import { demoOrigin, haversineDistanceKm, type Coordinates } from "./shared/geo";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { SignInScreen } from "./features/account/SignInScreen";
import { ChargeStep } from "./features/charging/ChargeStep";
import { EvidenceStep } from "./features/evidence/EvidenceStep";
import { OpsStep } from "./features/operations/OpsStep";
import { ReserveStep } from "./features/reservation/ReserveStep";
import { VehicleStep } from "./features/vehicle/VehicleStep";
import { WalletStep } from "./features/wallet/WalletStep";
import { buildSlots, friendlyError, money, subtitleFor, titleFor } from "./lib/presentation";
import { firstAvailableSlotIndex } from "./shared/reservationSlots";

type ViewId = "vehicle" | "reserve" | "charge" | "wallet" | "ops" | "evidence";
type StationDraft = Pick<ChargingStation, "name" | "address" | "operatingStart" | "operatingEnd" | "status">;
type StationFormState = {
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
type ReportsPayload = {
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

type NavSection = "drive" | "operate" | "system";

const viewItems: Array<{ id: ViewId; label: string; icon: ReactNode; section: NavSection }> = [
  { id: "vehicle", label: "My EV", icon: <Car />, section: "drive" },
  { id: "reserve", label: "Find Charger", icon: <MapPinned />, section: "drive" },
  { id: "charge", label: "Charging", icon: <Gauge />, section: "drive" },
  { id: "wallet", label: "Wallet", icon: <WalletCards />, section: "drive" },
  { id: "ops", label: "Operations", icon: <Wrench />, section: "operate" },
  { id: "evidence", label: "Activity", icon: <Activity />, section: "system" }
];

const navSectionLabels: Record<NavSection, string> = {
  drive: "Drive",
  operate: "Operate",
  system: "System"
};

const roleLabels: Record<UserRole, string> = {
  EV_DRIVER: "Driver",
  STATION_OPERATOR: "Operator",
  ADMINISTRATOR: "Admin"
};

const defaultUserIds: Record<UserRole, string> = {
  EV_DRIVER: "user-driver",
  STATION_OPERATOR: "user-operator",
  ADMINISTRATOR: "user-admin"
};

const roleViews: Record<UserRole, ViewId[]> = {
  EV_DRIVER: ["vehicle", "reserve", "charge", "wallet"],
  STATION_OPERATOR: ["ops"],
  ADMINISTRATOR: ["ops", "evidence"]
};

const mapApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export default function App() {
  const [view, setView] = useState<ViewId>("vehicle");
  const [role, setRole] = useState<UserRole>("EV_DRIVER");
  const [activeUserId, setActiveUserId] = useState(defaultUserIds.EV_DRIVER);
  const [signedOut, setSignedOut] = useState(false);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "bad" | "info"; text: string } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("group28-theme") as "light" | "dark") ?? "light";
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("group28-theme", theme); } catch {}
  }, [theme]);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    destructive?: boolean;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [filters, setFilters] = useState({ connector: "", power: "", maxPrice: "" });
  const [selectedStationId, setSelectedStationId] = useState("station-karsiyaka");
  const [selectedChargerId, setSelectedChargerId] = useState("charger-karsiyaka-ccs-03");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(120);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationMode, setLocationMode] = useState<"live" | "fallback">("fallback");
  const [vehicleForm, setVehicleForm] = useState({
    brand: "Tesla",
    modelName: "Model 3",
    batteryCapacityKwh: "75",
    connectorType: "CCS",
    plateNumber: "35 EV 2024"
  });
  const [sessionForm, setSessionForm] = useState({ reservationId: "", startSoc: "20", targetSoc: "80", endSoc: "80", connectivityLoss: false, malfunction: false });
  const [topUpAmount, setTopUpAmount] = useState("250");
  const [issueForm, setIssueForm] = useState({ category: "Connector damaged", description: "" });
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [chargerPriceDrafts, setChargerPriceDrafts] = useState<Record<string, string>>({});
  const [stationDrafts, setStationDrafts] = useState<Record<string, StationDraft>>({});
  const [selectedConfigStationId, setSelectedConfigStationId] = useState("station-karsiyaka");
  const [stationForm, setStationForm] = useState<StationFormState>({
    mode: "new",
    existingStationId: "",
    name: "Guzelyali Fast Charge",
    address: "Guzelyali, Izmir",
    latitude: "38.4030",
    longitude: "27.0950",
    operatingStart: "06:00",
    operatingEnd: "23:00",
    chargerCode: "",
    chargerType: "DC",
    connectorType: "CCS",
    powerKw: "50",
    pricePerKwh: "4.5"
  });

  const currentUser = data?.currentUser ?? data?.users.find((user) => user.id === activeUserId);
  const walletBalance = data?.wallet?.balance ?? 0;
  const selectedStation = data?.stations.find((station) => station.id === selectedStationId);
  const selectedCharger = selectedStation?.chargers.find((charger) => charger.id === selectedChargerId) ?? selectedStation?.chargers[0];
  const selectedVehicle = data?.vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? data?.vehicles[0];
  const slots = useMemo(
    () => buildSlots(selectedStation, selectedDurationMinutes, selectedCharger?.reservedWindows ?? []),
    [selectedStation?.id, selectedStation?.operatingStart, selectedStation?.operatingEnd, selectedDurationMinutes, selectedCharger?.id, selectedCharger?.reservedWindows]
  );
  const selectedSlot = slots[selectedSlotIndex] ?? slots[0];
  const activeSession = data?.sessions.find((session) => session.status === "ACTIVE");
  const confirmedReservations = data?.reservations.filter((reservation) => reservation.status === "CONFIRMED") ?? [];
  const favoriteStationIds = data?.favorites.map((favorite) => favorite.stationId) ?? [];
  const selectedStationIsFavorite = selectedStation ? favoriteStationIds.includes(selectedStation.id) : false;

  const filteredStations = useMemo(() => {
    if (!data) return [];
    return data.stations
      .map((station) => ({
        ...station,
        chargers: station.chargers.filter((charger) => {
          if (filters.connector && charger.connectorType !== filters.connector) return false;
          if (filters.power && charger.powerKw !== Number(filters.power)) return false;
          if (filters.maxPrice && charger.pricePerKwh > Number(filters.maxPrice)) return false;
          return true;
        })
      }))
      .filter((station) => station.chargers.length > 0);
  }, [data, filters]);

  const estimatedCost = selectedCharger && selectedSlot ? selectedCharger.powerKw * selectedCharger.pricePerKwh * selectedSlot.durationHours : 0;
  const visibleViewItems = viewItems.filter((item) => roleViews[role].includes(item.id));
  const routeOrigin = userLocation ?? demoOrigin;
  const distanceByStationId = useMemo(() => {
    const stations = data?.stations ?? [];
    return Object.fromEntries(
      stations.map((station) => [
        station.id,
        haversineDistanceKm(routeOrigin, { latitude: station.latitude, longitude: station.longitude })
      ])
    ) as Record<string, number>;
  }, [data?.stations, routeOrigin.latitude, routeOrigin.longitude]);

  useEffect(() => {
    if (signedOut) return;
    refresh();
  }, [role, activeUserId, signedOut]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMode("live");
      },
      () => setLocationMode("fallback"),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (view !== "reserve" || signedOut) return;
    let cancelled = false;
    const pollStations = async () => {
      try {
        const stations = await api<ChargingStation[]>("/api/stations");
        if (cancelled) return;
        setData((current) => (current ? { ...current, stations } : current));
        setLastRefresh(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      } catch {
        // The main action flow surfaces request errors; polling stays quiet to avoid noisy UI.
      }
    };
    pollStations();
    const timer = window.setInterval(pollStations, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [view, role, activeUserId, signedOut]);

  useEffect(() => {
    if (!activeSession || signedOut) return;
    let cancelled = false;
    const pollProjection = async () => {
      try {
        const projection = await api<{ session: ChargingSession; autoStopped: boolean; stopReason: string | null }>(`/api/sessions/${activeSession.id}/projection`);
        if (cancelled) return;
        setData((current) =>
          current
            ? {
                ...current,
                sessions: current.sessions.map((session) => (session.id === projection.session.id ? projection.session : session))
              }
            : current
        );
        if (projection.autoStopped && projection.stopReason) {
          setNotice({ type: "info", text: `Charging auto-stopped: ${projection.stopReason.replace(/_/g, " ").toLowerCase()}.` });
        }
      } catch {
        // Projection is opportunistic; manual completion still works if polling misses a tick.
      }
    };
    const timer = window.setInterval(pollProjection, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSession?.id, role, activeUserId, signedOut]);

  useEffect(() => {
    if (!roleViews[role].includes(view)) {
      setView(roleViews[role][0]);
    }
  }, [role, view]);

  useEffect(() => {
    if (!slots.length) return;
    const nextIndex = firstAvailableSlotIndex(slots);
    if (nextIndex >= 0 && (!slots[selectedSlotIndex] || slots[selectedSlotIndex].isReserved)) {
      setSelectedSlotIndex(nextIndex);
    }
  }, [slots, selectedSlotIndex]);

  useEffect(() => {
    if (data?.vehicles.length && !data.vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(data.vehicles[0].id);
    }
    if (!data?.vehicles.length && selectedVehicleId) {
      setSelectedVehicleId("");
    }
    if (confirmedReservations.length && !confirmedReservations.some((reservation) => reservation.id === sessionForm.reservationId)) {
      setSessionForm((form) => ({ ...form, reservationId: confirmedReservations[0].id }));
    }
    if (!confirmedReservations.length && sessionForm.reservationId) {
      setSessionForm((form) => ({ ...form, reservationId: "" }));
    }
  }, [data, confirmedReservations.length, selectedVehicleId, sessionForm.reservationId]);

  useEffect(() => {
    if (!data?.stations.length) return;
    if (!data.stations.some((station) => station.id === selectedConfigStationId)) {
      setSelectedConfigStationId(data.stations[0].id);
    }
  }, [data?.stations, selectedConfigStationId]);

  useEffect(() => {
    if (view !== "ops" || role === "EV_DRIVER") return;
    api<ReportsPayload>(role === "ADMINISTRATOR" ? "/api/admin/reports" : "/api/operator/reports")
      .then(setReports)
      .catch((error) => show("bad", error));
  }, [view, role, data?.sessions.length, data?.reservations.length, data?.issues.length]);

  async function api<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-demo-role": role,
        "x-demo-user-id": activeUserId,
        ...(options.headers ?? {})
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.errors?.join(" ") ?? payload.error ?? payload.detail ?? "Request failed");
    }
    return payload as T;
  }

  async function refresh() {
    setLoading(true);
    try {
      setData(await api<BootstrapPayload>("/api/bootstrap"));
      setLastRefresh(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (error) {
      show("bad", error);
    } finally {
      setLoading(false);
    }
  }

  async function action<T>(run: () => Promise<T>, message: string, nextView?: ViewId) {
    setLoading(true);
    try {
      await run();
      await refresh();
      setNotice({ type: "ok", text: message });
      if (nextView) setView(nextView);
    } catch (error) {
      show("bad", error);
    } finally {
      setLoading(false);
    }
  }

  function show(type: "bad" | "info", error: unknown) {
    setNotice({ type, text: friendlyError(error) });
  }

  function driverId() {
    return currentUser?.role === "EV_DRIVER" ? currentUser.id : activeUserId;
  }

  function resetDriverSelections() {
    setSelectedVehicleId("");
    setSessionForm((form) => ({ ...form, reservationId: "" }));
  }

  function switchRole(nextRole: UserRole) {
    const nextUser = data?.users.find((user) => user.role === nextRole && user.isActive);
    setRole(nextRole);
    setActiveUserId(nextUser?.id ?? defaultUserIds[nextRole]);
    setSignedOut(false);
    setView(roleViews[nextRole][0]);
    resetDriverSelections();
  }

  function switchUser(userId: string) {
    const nextUser = data?.users.find((user) => user.id === userId);
    if (!nextUser) return;
    setRole(nextUser.role);
    setActiveUserId(nextUser.id);
    setSignedOut(false);
    setView(roleViews[nextUser.role][0]);
    resetDriverSelections();
  }

  function signOut() {
    setSignedOut(true);
    setNotice(null);
  }

  async function submitVehicle(event: FormEvent) {
    event.preventDefault();
    await action(
      () =>
        api<Vehicle>("/api/vehicles", {
          method: "POST",
          body: JSON.stringify({ ...vehicleForm, userId: driverId(), batteryCapacityKwh: Number(vehicleForm.batteryCapacityKwh) })
        }),
      "Vehicle saved. You can now choose a compatible charger.",
      "reserve"
    );
  }

  async function reserve(event: FormEvent) {
    event.preventDefault();
    if (!selectedVehicle || !selectedCharger || !selectedSlot) return;
    if (selectedSlot.isReserved) {
      setNotice({ type: "bad", text: "This slot is already reserved. Please select an available time." });
      return;
    }
    await action(
      () =>
        api<Reservation>("/api/reservations", {
          method: "POST",
          body: JSON.stringify({
            userId: driverId(),
            vehicleId: selectedVehicle.id,
            chargerId: selectedCharger.id,
            startTime: selectedSlot.start.toISOString(),
            endTime: selectedSlot.end.toISOString()
          })
        }),
      "Reservation confirmed. You're all set — see you at the charger!",
      "charge"
    );
  }

  async function startSession(event: FormEvent) {
    event.preventDefault();
    await action(
      () =>
        api<ChargingSession>("/api/sessions/start", {
          method: "POST",
          body: JSON.stringify({
            reservationId: sessionForm.reservationId,
            startSoc: Number(sessionForm.startSoc),
            targetSoc: Number(sessionForm.targetSoc)
          })
        }),
      "Charging session started."
    );
  }

  async function completeSession(event: FormEvent) {
    event.preventDefault();
    if (!activeSession) {
      setNotice({ type: "bad", text: "Start an active charging session first." });
      return;
    }
    await action(
      () =>
        api<ChargingSession>(`/api/sessions/${activeSession.id}/complete`, {
          method: "POST",
          body: JSON.stringify({
            endSoc: Number(sessionForm.endSoc),
            simulateConnectivityLoss: sessionForm.connectivityLoss,
            simulateChargerMalfunction: sessionForm.malfunction
          })
        }),
      "Charging complete. Your receipt is in the wallet.",
      "wallet"
    );
  }

  async function cancelReservation(reservation: Reservation) {
    await action(
      () => api<Reservation>(`/api/reservations/${reservation.id}/cancel`, { method: "POST" }),
      "Reservation cancelled. Any held amount has been refunded to your wallet."
    );
  }

  async function markNoShow(reservation: Reservation) {
    await action(
      () => api<Reservation>(`/api/reservations/${reservation.id}/no-show`, { method: "POST" }),
      "Reservation marked as no-show and charger availability restored."
    );
  }

  async function simulateSessionSync() {
    if (!activeSession) {
      setNotice({ type: "bad", text: "Start an active charging session before simulating sync recovery." });
      return;
    }
    await action(
      () => api<ChargingSession>(`/api/sessions/${activeSession.id}/simulate-sync`, { method: "POST" }),
      "Temporary connectivity loss cached locally and synced within 30 seconds."
    );
  }

  async function topUpWallet(event: FormEvent) {
    event.preventDefault();
    if (!data?.wallet || currentUser?.role !== "EV_DRIVER") {
      setNotice({ type: "bad", text: "Wallet actions are available only for driver accounts." });
      return;
    }
    await action(
      () => api("/api/wallet/top-up", { method: "POST", body: JSON.stringify({ userId: driverId(), amount: Number(topUpAmount) }) }),
      "Wallet topped up — your new balance is ready."
    );
  }

  async function submitIssue(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedStation) return;
    await action(
      () =>
        api("/api/issues", {
          method: "POST",
          body: JSON.stringify({ userId: driverId(), stationId: selectedStation.id, ...issueForm })
        }),
      "Issue report sent to the operator dashboard."
    );
  }

  async function toggleFavorite() {
    if (!selectedStation) return;
    if (selectedStationIsFavorite) {
      await action(
        () => api("/api/favorites", { method: "DELETE", body: JSON.stringify({ userId: driverId(), stationId: selectedStation.id }) }),
        "Station removed from your favorites."
      );
      return;
    }
    await action(() => api("/api/favorites", { method: "POST", body: JSON.stringify({ userId: driverId(), stationId: selectedStation.id }) }), "Station added to your favorites.");
  }

  async function updateCharger(charger: Charger, status: ChargerStatus, pricePerKwh = charger.pricePerKwh) {
    if (status === "OUT_OF_SERVICE" && charger.status !== "OUT_OF_SERVICE") {
      setConfirmState({
        title: "Take charger out of service?",
        message: `${charger.code} will be marked Out of service. Any active reservations on this charger will be auto-cancelled and customers notified. Continue?`,
        destructive: true,
        confirmLabel: "Take out of service",
        onConfirm: () => runChargerUpdate(charger, status, pricePerKwh)
      });
      return;
    }
    const priceChanged = Number.isFinite(pricePerKwh) && Math.abs(pricePerKwh - charger.pricePerKwh) > 0.001;
    if (priceChanged && status === charger.status) {
      const delta = pricePerKwh - charger.pricePerKwh;
      const pct = charger.pricePerKwh > 0 ? (delta / charger.pricePerKwh) * 100 : 0;
      const direction = delta > 0 ? "increase" : "decrease";
      setConfirmState({
        title: `Confirm price ${direction}?`,
        message: `Set ${charger.code} price to ${money(pricePerKwh)} (was ${money(charger.pricePerKwh)}, ${delta > 0 ? "+" : ""}${pct.toFixed(1)}%). Customers will see the new price on future reservations.`,
        destructive: delta > 0,
        confirmLabel: "Save price",
        onConfirm: () => runChargerUpdate(charger, status, pricePerKwh)
      });
      return;
    }
    await runChargerUpdate(charger, status, pricePerKwh);
  }

  async function runChargerUpdate(charger: Charger, status: ChargerStatus, pricePerKwh: number) {
    const priceChanged = Number.isFinite(pricePerKwh) && Math.abs(pricePerKwh - charger.pricePerKwh) > 0.001;
    const statusChanged = status !== charger.status;
    let message = "No changes to save.";
    if (priceChanged && statusChanged) {
      message = `${charger.code}: status → ${status.replace("_", " ").toLowerCase()}, price ${money(charger.pricePerKwh)} → ${money(pricePerKwh)}.`;
    } else if (priceChanged) {
      const delta = pricePerKwh - charger.pricePerKwh;
      const pct = charger.pricePerKwh > 0 ? (delta / charger.pricePerKwh) * 100 : 0;
      message = `Price updated for ${charger.code}: ${money(charger.pricePerKwh)} → ${money(pricePerKwh)} (${delta > 0 ? "+" : ""}${pct.toFixed(1)}%).`;
    } else if (statusChanged) {
      message = `${charger.code} is now ${status.replace("_", " ").toLowerCase()}.`;
    }
    await action(
      () => api(`/api/operator/chargers/${charger.id}/status`, { method: "PATCH", body: JSON.stringify({ status, pricePerKwh }) }),
      message
    );
    setChargerPriceDrafts((drafts) => {
      const next = { ...drafts };
      delete next[charger.id];
      return next;
    });
  }

  async function updateStation(station: ChargingStation) {
    const draft = stationDrafts[station.id] ?? {
      name: station.name,
      address: station.address,
      operatingStart: station.operatingStart,
      operatingEnd: station.operatingEnd,
      status: station.status
    };
    await action(
      () => api(`/api/operator/stations/${station.id}`, { method: "PATCH", body: JSON.stringify(draft) }),
      "Station profile updated."
    );
  }

  async function updateIssue(issue: IssueReport, status: string) {
    await action(() => api(`/api/issues/${issue.id}`, { method: "PATCH", body: JSON.stringify({ status }) }), "Issue status updated.");
  }

  async function loadReports() {
    await action(async () => setReports(await api<ReportsPayload>(role === "ADMINISTRATOR" ? "/api/admin/reports" : "/api/operator/reports")), "Reports refreshed.");
  }

  async function simulateFailedLogin() {
    await action(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await api("/api/security/simulate-failed-login", { method: "POST", body: JSON.stringify({ email: "driver@group28.demo" }) });
      }
    }, "Repeated failed sign-in detected — administrators have been alerted.");
  }

  async function addStation(event: FormEvent) {
    event.preventDefault();
    if (stationForm.mode === "existing") {
      if (!stationForm.existingStationId) {
        setNotice({ type: "bad", text: "Please select a station to add the charger to." });
        return;
      }
      const target = data?.stations.find((s) => s.id === stationForm.existingStationId);
      await action(
        () =>
          api<Charger>(`/api/admin/stations/${stationForm.existingStationId}/chargers`, {
            method: "POST",
            body: JSON.stringify({
              chargerCode: stationForm.chargerCode.trim() || undefined,
              chargerType: stationForm.chargerType,
              connectorType: stationForm.connectorType,
              powerKw: Number(stationForm.powerKw),
              pricePerKwh: Number(stationForm.pricePerKwh)
            })
          }),
        `Charger added to ${target?.name ?? "the station"}.`
      );
      return;
    }
    await action(
      () =>
        api<ChargingStation>("/api/admin/stations", {
          method: "POST",
          body: JSON.stringify({
            name: stationForm.name,
            address: stationForm.address,
            operatingStart: stationForm.operatingStart,
            operatingEnd: stationForm.operatingEnd,
            chargerCode: stationForm.chargerCode.trim() || undefined,
            chargerType: stationForm.chargerType,
            connectorType: stationForm.connectorType,
            latitude: Number(stationForm.latitude),
            longitude: Number(stationForm.longitude),
            powerKw: Number(stationForm.powerKw),
            pricePerKwh: Number(stationForm.pricePerKwh)
          })
        }),
      "Station and first charger added."
    );
  }

  function deleteStation(station: ChargingStation) {
    setConfirmState({
      title: "Remove station?",
      message: `"${station.name}" and all of its ${station.chargers.length} charger(s) will be permanently removed. Any upcoming reservations on this station will be cancelled. This cannot be undone.`,
      destructive: true,
      confirmLabel: "Remove station",
      onConfirm: () =>
        action(
          () => api<ChargingStation>(`/api/admin/stations/${station.id}`, { method: "DELETE" }),
          `${station.name} removed from the network.`
        )
    });
  }

  async function updateUser(userId: string, changes: { role?: UserRole; isActive?: boolean }) {
    const target = data?.users.find((user) => user.id === userId);
    const deactivating = changes.isActive === false;
    const changingRole = !!changes.role && target && changes.role !== target.role;
    if (deactivating && target) {
      setConfirmState({
        title: "Deactivate user?",
        message: `${target.name} (${target.email}) will lose access until reactivated. Active sessions will not be terminated. Continue?`,
        destructive: true,
        confirmLabel: "Deactivate",
        onConfirm: () =>
          action(
            () => api(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(changes) }),
            `${target.name} has been deactivated.`
          )
      });
      return;
    }
    if (changingRole && target) {
      setConfirmState({
        title: "Change user role?",
        message: `${target.name}'s role will change from ${target.role.replace("_", " ").toLowerCase()} to ${changes.role!.replace("_", " ").toLowerCase()}. Continue?`,
        confirmLabel: "Change role",
        onConfirm: () =>
          action(
            () => api(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(changes) }),
            `${target.name} is now a ${changes.role!.replace("_", " ").toLowerCase()}.`
          )
      });
      return;
    }
    await action(
      () => api(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(changes) }),
      "User account updated."
    );
  }

  if (!data) {
    return (
      <main className="loading">
        <PlugZap />
        <p>Loading</p>
      </main>
    );
  }

  if (signedOut) {
    return <SignInScreen users={data.users} onSignIn={switchUser} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Zap />
          <div>
            <strong>Voltline</strong>
            <span>EV Charge Network</span>
          </div>
        </div>
        <nav>
          {(Object.keys(navSectionLabels) as NavSection[]).flatMap((section) => {
            const items = visibleViewItems.filter((item) => item.section === section);
            if (items.length === 0) return [];
            return [
              <div key={`label-${section}`} className="nav-section-label">{navSectionLabels[section]}</div>,
              ...items.map((item) => (
                <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))
            ];
          })}
        </nav>
        <div className="sidebar-card">
          <span>{data.wallet ? "Wallet Balance" : "Signed in as"}</span>
          <strong className={data.wallet ? "mono sidebar-balance" : "sidebar-identity"}>{data.wallet ? money(data.wallet.balance) : currentUser?.email ?? "No account"}</strong>
          <small>{currentUser?.name ?? "Active user"}</small>
          <div className="sidebar-card-row">
            <span>Role</span>
            <span className="role-tag">{roleLabels[role]}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-side topbar-left">
            <p className="eyebrow">{subtitleFor(view)}</p>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="role-switch-center" aria-label="Switch role">
            <div className="role-switch" role="tablist">
              <span
                className="role-switch-indicator"
                style={{
                  transform: `translateX(${(Object.keys(roleLabels) as UserRole[]).indexOf(role) * 100}%)`
                }}
                aria-hidden
              />
              {(Object.keys(roleLabels) as UserRole[]).map((item) => (
                <button
                  key={item}
                  role="tab"
                  aria-selected={role === item}
                  className={role === item ? "selected" : ""}
                  onClick={() => switchRole(item)}
                >
                  {roleLabels[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="topbar-side topbar-actions">
            <label className="account-select">
              <UserCircle />
              <select value={activeUserId} onChange={(event) => switchUser(event.target.value)} aria-label="Active account">
                {data.users.filter((user) => user.isActive).map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <button className="icon-button" onClick={refresh} title="Refresh data">
              <RefreshCw />
            </button>
            <button className="icon-button" onClick={signOut} title="Sign out">
              <LogOut />
            </button>
          </div>
        </header>

        {notice && (
          <div className={`notice ${notice.type}`}>
            {notice.type === "ok" ? <Check /> : <AlertTriangle />}
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)}>Close</button>
          </div>
        )}
        <ConfirmDialog
          open={!!confirmState}
          title={confirmState?.title ?? ""}
          message={confirmState?.message ?? ""}
          destructive={confirmState?.destructive}
          confirmLabel={confirmState?.confirmLabel}
          onConfirm={() => {
            const next = confirmState;
            setConfirmState(null);
            next?.onConfirm();
          }}
          onCancel={() => setConfirmState(null)}
        />
        {loading && <div className="thin-loader" />}

        <div className="view-stage" key={`${role}-${view}`}>
        {view === "vehicle" && (
          <VehicleStep
            vehicles={data.vehicles}
            form={vehicleForm}
            setForm={setVehicleForm}
            selectedVehicleId={selectedVehicleId}
            setSelectedVehicleId={setSelectedVehicleId}
            onSubmit={submitVehicle}
            onContinue={() => setView("reserve")}
          />
        )}

        {view === "reserve" && selectedStation && (
          <ReserveStep
            stations={filteredStations}
            selectedStation={selectedStation}
            selectedCharger={selectedCharger}
            selectedVehicle={selectedVehicle}
            selectedVehicleId={selectedVehicleId}
            vehicles={data.vehicles}
            filters={filters}
            slots={slots}
            selectedSlotIndex={selectedSlotIndex}
            estimatedCost={estimatedCost}
            walletBalance={walletBalance}
            isFavorite={selectedStationIsFavorite}
            favoriteStationIds={favoriteStationIds}
            lastRefresh={lastRefresh}
            distanceByStationId={distanceByStationId}
            routeOrigin={routeOrigin}
            locationMode={locationMode}
            selectedDurationMinutes={selectedDurationMinutes}
            setFilters={setFilters}
            setSelectedStationId={(stationId) => {
              setSelectedStationId(stationId);
              const station = data.stations.find((item) => item.id === stationId);
              setSelectedChargerId(station?.chargers[0]?.id ?? "");
              setSelectedSlotIndex(0);
            }}
            setSelectedChargerId={setSelectedChargerId}
            setSelectedVehicleId={setSelectedVehicleId}
            setSelectedSlotIndex={setSelectedSlotIndex}
            setSelectedDurationMinutes={(minutes) => {
              setSelectedDurationMinutes(minutes);
              setSelectedSlotIndex(0);
            }}
            onReserve={reserve}
            onFavorite={toggleFavorite}
            issueForm={issueForm}
            setIssueForm={setIssueForm}
            onIssue={submitIssue}
          />
        )}

        {view === "charge" && (
          <ChargeStep
            reservations={data.reservations}
            confirmedReservations={confirmedReservations}
            activeSession={activeSession}
            sessions={data.sessions}
            walletBalance={walletBalance}
            form={sessionForm}
            setForm={setSessionForm}
            onStart={startSession}
            onComplete={completeSession}
            onCancel={cancelReservation}
            onNoShow={markNoShow}
            onSync={simulateSessionSync}
          />
        )}

        {view === "wallet" && <WalletStep data={data} topUpAmount={topUpAmount} setTopUpAmount={setTopUpAmount} onTopUp={topUpWallet} />}

        {view === "ops" && (
          <OpsStep
            role={role}
            data={data}
            reports={reports}
            stationForm={stationForm}
            setStationForm={setStationForm}
            stationDrafts={stationDrafts}
            setStationDrafts={setStationDrafts}
            selectedConfigStationId={selectedConfigStationId}
            setSelectedConfigStationId={setSelectedConfigStationId}
            chargerPriceDrafts={chargerPriceDrafts}
            setChargerPriceDrafts={setChargerPriceDrafts}
            onUpdateCharger={updateCharger}
            onUpdateStation={updateStation}
            onUpdateIssue={updateIssue}
            onReports={loadReports}
            onSecurity={simulateFailedLogin}
            onAddStation={addStation}
            onDeleteStation={deleteStation}
            onUpdateUser={updateUser}
          />
        )}

        {view === "evidence" && <EvidenceStep data={data} filter={evidenceFilter} setFilter={setEvidenceFilter} />}
        </div>
      </main>
    </div>
  );
}

