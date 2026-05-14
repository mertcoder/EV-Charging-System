import { useState, type FormEvent } from "react";
import { Car, PlugZap, RefreshCw, Star } from "lucide-react";
import { MapView } from "../../MapView";
import type { Charger, ChargingStation, Vehicle } from "../../shared/domain";
import type { Coordinates } from "../../shared/geo";
import type { Slot } from "../../lib/presentation";
import { stationAvailability } from "../../lib/presentation";
import { ReserveDialog } from "./ReserveDialog";

const mapApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function ReserveStep(props: {
  stations: ChargingStation[];
  selectedStation: ChargingStation;
  selectedCharger?: Charger;
  selectedVehicle?: Vehicle;
  selectedVehicleId: string;
  vehicles: Vehicle[];
  filters: { connector: string; power: string; maxPrice: string; maxDistance: string };
  slots: Slot[];
  selectedSlotIndex: number;
  estimatedCost: number;
  walletBalance: number;
  isFavorite: boolean;
  favoriteStationIds: string[];
  lastRefresh: string;
  distanceByStationId: Record<string, number>;
  routeOrigin: Coordinates;
  locationMode: "live" | "fallback";
  selectedDurationMinutes: number;
  setFilters: (filters: { connector: string; power: string; maxPrice: string; maxDistance: string }) => void;
  setSelectedStationId: (id: string) => void;
  setSelectedChargerId: (id: string) => void;
  setSelectedVehicleId: (id: string) => void;
  setSelectedSlotIndex: (index: number) => void;
  setSelectedDurationMinutes: (minutes: number) => void;
  onReserve: (event: FormEvent) => void;
  onFavorite: () => void;
  issueForm: { category: string; description: string };
  setIssueForm: (form: { category: string; description: string }) => void;
  onIssue: (event?: FormEvent) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  function selectStation(stationId: string) {
    props.setSelectedStationId(stationId);
  }

  function openReserveFor(stationId: string) {
    props.setSelectedStationId(stationId);
    setDialogOpen(true);
  }

  function handleReserve(event: FormEvent) {
    props.onReserve(event);
  }

  return (
    <section className="reserve-layout reserve-layout-stacked">
      <div className="map-panel">
        <div className="map-toolbar">
          <div className="map-toolbar-heading">
            <h2>Nearby stations</h2>
            <p>Pick a station on the map or below to start a reservation.</p>
          </div>
          <div className="filter-row">
            <label className="vehicle-quick-pick">
              <Car />
              <select
                value={props.selectedVehicleId}
                onChange={(event) => props.setSelectedVehicleId(event.target.value)}
                aria-label="Active vehicle"
              >
                {props.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.modelName}
                  </option>
                ))}
              </select>
            </label>
            <select
              value={props.filters.maxDistance}
              onChange={(event) => props.setFilters({ ...props.filters, maxDistance: event.target.value })}
              aria-label="Maximum distance"
            >
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
              <option value="">Any distance</option>
            </select>
            <select
              value={props.filters.connector}
              onChange={(event) => props.setFilters({ ...props.filters, connector: event.target.value })}
            >
              <option value="">All connectors</option>
              <option value="CCS">CCS</option>
              <option value="TYPE_2">Type 2</option>
              <option value="CHADEMO">CHAdeMO</option>
            </select>
            <select
              value={props.filters.power}
              onChange={(event) => props.setFilters({ ...props.filters, power: event.target.value })}
            >
              <option value="">All power levels</option>
              <option value="22">22 kW</option>
              <option value="50">50 kW</option>
              <option value="150">150 kW</option>
            </select>
            <input
              aria-label="Maximum price per kWh"
              type="number"
              min="0"
              step="0.5"
              placeholder="Max TL/kWh"
              value={props.filters.maxPrice}
              onChange={(event) => props.setFilters({ ...props.filters, maxPrice: event.target.value })}
            />
          </div>
        </div>
        <MapView
          stations={props.stations}
          selectedStationId={props.selectedStation.id}
          apiKey={mapApiKey}
          origin={props.routeOrigin}
          locationMode={props.locationMode}
          onSelect={selectStation}
          onReserveClick={openReserveFor}
        />
        <div className="map-refresh-line">
          <RefreshCw />
          <span>Availability refreshed {props.lastRefresh || "just now"}</span>
        </div>
        <div className="station-strip">
          {props.stations.map((station) => {
            const stationIsFavorite = props.favoriteStationIds.includes(station.id);
            return (
              <article key={station.id} className={`station-strip-card ${station.id === props.selectedStation.id ? "selected" : ""}`}>
                <button
                  className="station-strip-main"
                  type="button"
                  onClick={() => selectStation(station.id)}
                  title="Show route on map"
                >
                  <span className="station-card-header">
                    <strong>{station.name}</strong>
                    {stationIsFavorite && (
                      <span className="favorite-mini">
                        <Star fill="currentColor" /> Favorite
                      </span>
                    )}
                  </span>
                  <span>{props.distanceByStationId[station.id] ?? "-"} km · {stationAvailability(station)}</span>
                </button>
                <button
                  type="button"
                  className="station-strip-cta"
                  onClick={() => openReserveFor(station.id)}
                  aria-label={`Reserve at ${station.name}`}
                >
                  <PlugZap /> Reserve
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <ReserveDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        station={props.selectedStation}
        selectedCharger={props.selectedCharger}
        selectedVehicle={props.selectedVehicle}
        slots={props.slots}
        selectedSlotIndex={props.selectedSlotIndex}
        estimatedCost={props.estimatedCost}
        walletBalance={props.walletBalance}
        isFavorite={props.isFavorite}
        routeOrigin={props.routeOrigin}
        selectedDurationMinutes={props.selectedDurationMinutes}
        setSelectedChargerId={props.setSelectedChargerId}
        setSelectedSlotIndex={props.setSelectedSlotIndex}
        setSelectedDurationMinutes={props.setSelectedDurationMinutes}
        onReserve={handleReserve}
        onFavorite={props.onFavorite}
        issueForm={props.issueForm}
        setIssueForm={props.setIssueForm}
        onIssue={props.onIssue}
      />
    </section>
  );
}
