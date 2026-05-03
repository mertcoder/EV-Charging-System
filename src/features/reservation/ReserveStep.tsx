import type { FormEvent } from "react";
import { AlertTriangle, Check, Navigation, RefreshCw, Star } from "lucide-react";
import { MapView } from "../../MapView";
import type { Charger, ChargingStation, Vehicle } from "../../shared/domain";
import type { Coordinates } from "../../shared/geo";
import type { Slot } from "../../lib/presentation";
import { googleMapsDirectionsUrl, money, stationAvailability } from "../../lib/presentation";
import { Empty, Input, Metric } from "../../components/common";

const mapApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function ReserveStep(props: {
  stations: ChargingStation[];
  selectedStation: ChargingStation;
  selectedCharger?: Charger;
  selectedVehicle?: Vehicle;
  selectedVehicleId: string;
  vehicles: Vehicle[];
  filters: { connector: string; power: string; maxPrice: string };
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
  setFilters: (filters: { connector: string; power: string; maxPrice: string }) => void;
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
  const compatibility = props.selectedVehicle && props.selectedCharger ? props.selectedVehicle.connectorType === props.selectedCharger.connectorType : false;
  const hasEnoughBalance = props.walletBalance >= props.estimatedCost;
  const selectedSlot = props.slots[props.selectedSlotIndex];
  const canReserve = Boolean(props.selectedVehicle && props.selectedCharger && selectedSlot && !selectedSlot.isReserved && compatibility && hasEnoughBalance);
  return (
    <section className="reserve-layout">
      <div className="map-panel">
        <div className="map-toolbar">
          <div>
            <h2>Nearby stations</h2>
          </div>
          <div className="filter-row">
            <select value={props.filters.connector} onChange={(event) => props.setFilters({ ...props.filters, connector: event.target.value })}>
              <option value="">All connectors</option>
              <option value="CCS">CCS</option>
              <option value="TYPE_2">Type 2</option>
              <option value="CHADEMO">CHAdeMO</option>
            </select>
            <select value={props.filters.power} onChange={(event) => props.setFilters({ ...props.filters, power: event.target.value })}>
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
        <MapView stations={props.stations} selectedStationId={props.selectedStation.id} apiKey={mapApiKey} origin={props.routeOrigin} locationMode={props.locationMode} onSelect={props.setSelectedStationId} />
        <div className="map-refresh-line">
          <RefreshCw />
          <span>Availability refreshed {props.lastRefresh || "just now"}</span>
        </div>
        <div className="station-strip">
          {props.stations.map((station) => {
            const stationIsFavorite = props.favoriteStationIds.includes(station.id);
            return (
              <button key={station.id} className={station.id === props.selectedStation.id ? "selected" : ""} onClick={() => props.setSelectedStationId(station.id)}>
                <span className="station-card-header">
                  <strong>{station.name}</strong>
                  {stationIsFavorite && (
                    <span className="favorite-mini">
                      <Star fill="currentColor" /> Favorite
                    </span>
                  )}
                </span>
                <span>{props.distanceByStationId[station.id] ?? "-"} km - {stationAvailability(station)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form className="booking-panel" onSubmit={props.onReserve}>
        <div className="station-heading">
          <div>
            <div className="station-title-line">
              <h2>{props.selectedStation.name}</h2>
              {props.isFavorite && <span className="status-pill favorite-status">Favorited</span>}
            </div>
            <p>{props.selectedStation.address}</p>
          </div>
          <button
            type="button"
            className={`favorite-action ${props.isFavorite ? "active" : ""}`}
            onClick={props.onFavorite}
            aria-pressed={props.isFavorite}
            title={props.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star fill={props.isFavorite ? "currentColor" : "none"} />
            <span>{props.isFavorite ? "Remove" : "Favorite"}</span>
          </button>
        </div>

        <div className="mini-metrics">
          <Metric label="Status" value={stationAvailability(props.selectedStation)} />
          <Metric label="Hours" value={`${props.selectedStation.operatingStart}-${props.selectedStation.operatingEnd}`} />
          <Metric label="Wallet" value={money(props.walletBalance)} />
        </div>

        <label>
          Vehicle
          <select value={props.selectedVehicleId} onChange={(event) => props.setSelectedVehicleId(event.target.value)}>
            {props.vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.brand} {vehicle.modelName} - {vehicle.connectorType}
              </option>
            ))}
          </select>
        </label>

        <label>
          Charger
          <select value={props.selectedCharger?.id ?? ""} onChange={(event) => props.setSelectedChargerId(event.target.value)}>
            {props.selectedStation.chargers.map((charger) => (
              <option key={charger.id} value={charger.id}>
                {charger.code} - {charger.connectorType} - {charger.powerKw}kW
              </option>
            ))}
          </select>
        </label>

        <div className={`compat-card ${compatibility ? "ok" : "bad"}`}>
          {compatibility ? <Check /> : <AlertTriangle />}
          <span>{compatibility ? "Compatible connector" : "Incompatible connector"}</span>
        </div>

        <div>
          <div className="field-label">Duration</div>
          <div className="duration-row" role="group" aria-label="Reservation duration">
            {[30, 60, 90, 120].map((minutes) => (
              <button key={minutes} type="button" className={props.selectedDurationMinutes === minutes ? "selected" : ""} onClick={() => props.setSelectedDurationMinutes(minutes)}>
                {minutes} min
              </button>
            ))}
          </div>
          <div className="field-label">Available slots</div>
          {props.slots.length === 0 ? (
            <Empty text="No slots match this station's operating hours." />
          ) : (
            <div className="slot-grid">
              {props.slots.map((slot, index) => (
                <button
                  key={slot.label}
                  type="button"
                  className={`${props.selectedSlotIndex === index ? "selected" : ""} ${slot.isReserved ? "reserved" : ""}`}
                  onClick={() => props.setSelectedSlotIndex(index)}
                  disabled={slot.isReserved}
                  aria-disabled={slot.isReserved}
                >
                  <strong>{slot.dayLabel}</strong>
                  <span className="mono">{slot.timeLabel}</span>
                  {slot.isReserved && <small>Reserved</small>}
                </button>
              ))}
            </div>
          )}
          {props.slots.length > 0 && props.slots.every((slot) => slot.isReserved) && (
            <div className="compat-card bad">
              <AlertTriangle />
              <span>All visible slots for this charger are already reserved.</span>
            </div>
          )}
        </div>

        <div className="route-card">
          <Navigation />
          <div>
            <strong>Route ready</strong>
            <span>
              <span className="mono">{props.distanceByStationId[props.selectedStation.id] ?? "-"} km</span> - {props.locationMode === "live" ? "using live browser location" : "using demo origin"}
            </span>
          </div>
          <a className="secondary route-link" href={googleMapsDirectionsUrl(props.selectedStation, props.routeOrigin)} target="_blank" rel="noreferrer">
            <Navigation /> Open route
          </a>
        </div>

        <div className="total-line">
          <span>Estimated cost</span>
          <strong className="mono">{money(props.estimatedCost)}</strong>
        </div>

        <div className={`compat-card ${hasEnoughBalance ? "ok" : "bad"}`}>
          {hasEnoughBalance ? <Check /> : <AlertTriangle />}
          <span>{hasEnoughBalance ? "Wallet balance is enough for the estimate" : "Wallet balance is below the estimated cost"}</span>
        </div>

        <button className="primary wide" type="submit" disabled={!canReserve}>
          Create reservation
        </button>

        <details className="quiet-details">
          <summary>Report issue</summary>
          <div className="issue-mini">
            <Input label="Category" value={props.issueForm.category} onChange={(value) => props.setIssueForm({ ...props.issueForm, category: value })} />
            <textarea value={props.issueForm.description} onChange={(event) => props.setIssueForm({ ...props.issueForm, description: event.target.value })} placeholder="Description (optional)" />
            <button className="secondary" type="button" onClick={() => props.onIssue()}>Send</button>
          </div>
        </details>
      </form>
    </section>
  );
}
