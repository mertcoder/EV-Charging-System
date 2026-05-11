import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, ChevronDown, Navigation, RefreshCw, Star } from "lucide-react";
import { MapView } from "../../MapView";
import type { Charger, ChargingStation, Vehicle } from "../../shared/domain";
import type { Coordinates } from "../../shared/geo";
import type { Slot } from "../../lib/presentation";
import { googleMapsDirectionsUrl, money, stationAvailability } from "../../lib/presentation";
import { Empty, Input } from "../../components/common";

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

      <BookingPanel {...props} compatibility={compatibility} hasEnoughBalance={hasEnoughBalance} canReserve={canReserve} />
    </section>
  );
}

function BookingPanel(props: Parameters<typeof ReserveStep>[0] & { compatibility: boolean; hasEnoughBalance: boolean; canReserve: boolean }) {
  const [showAllSlots, setShowAllSlots] = useState(false);
  const visibleSlots = showAllSlots ? props.slots : props.slots.slice(0, 4);
  const allReserved = props.slots.length > 0 && props.slots.every((slot) => slot.isReserved);
  const firstCompatible = props.selectedStation.chargers.find((c) => c.connectorType === props.selectedVehicle?.connectorType);

  return (
    <form className="booking-panel" onSubmit={props.onReserve}>
      <div className="station-heading">
        <div>
          <div className="station-title-line">
            <h2>{props.selectedStation.name}</h2>
            {props.isFavorite && <span className="status-pill favorite-status">Favorite</span>}
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
        </button>
      </div>

      <div className="booking-section">
        <div className="booking-section-label-row">
          <span className="booking-section-label">Your match</span>
          <span className={`match-status-pill ${props.compatibility ? "ok" : "bad"}`}>
            {props.compatibility ? <Check /> : <AlertTriangle />}
            {props.compatibility ? "Compatible" : "Incompatible"}
          </span>
        </div>
        <div className="match-card">
          <div className="match-side">
            <small>Vehicle</small>
            <select value={props.selectedVehicleId} onChange={(event) => props.setSelectedVehicleId(event.target.value)}>
              {props.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.modelName}
                </option>
              ))}
            </select>
            <span className="match-meta">{props.selectedVehicle?.connectorType}</span>
          </div>
          <div className="match-side">
            <small>Charger</small>
            <select value={props.selectedCharger?.id ?? ""} onChange={(event) => props.setSelectedChargerId(event.target.value)}>
              {props.selectedStation.chargers.map((charger) => (
                <option key={charger.id} value={charger.id}>
                  {charger.code}
                </option>
              ))}
            </select>
            <span className="match-meta">
              {props.selectedCharger?.connectorType} · {props.selectedCharger?.powerKw}kW
            </span>
          </div>
        </div>
        {!props.compatibility && firstCompatible && (
          <button
            type="button"
            className="secondary subtle match-suggest"
            onClick={() => props.setSelectedChargerId(firstCompatible.id)}
          >
            Use compatible charger ({firstCompatible.code})
          </button>
        )}
        {!props.compatibility && !firstCompatible && (
          <p className="match-warning">No charger here matches your vehicle's connector.</p>
        )}
      </div>

      <div className="booking-section">
        <div className="booking-section-label">When?</div>
        <div className="duration-row" role="group" aria-label="Reservation duration">
          {[30, 60, 90, 120].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={props.selectedDurationMinutes === minutes ? "selected" : ""}
              onClick={() => props.setSelectedDurationMinutes(minutes)}
            >
              {minutes} min
            </button>
          ))}
        </div>

        {props.slots.length === 0 ? (
          <Empty text="No slots match this station's operating hours." />
        ) : (
          <>
            <div className="slot-grid">
              {visibleSlots.map((slot, indexInVisible) => {
                const actualIndex = props.slots.indexOf(slot);
                return (
                  <button
                    key={slot.label}
                    type="button"
                    className={`${props.selectedSlotIndex === actualIndex ? "selected" : ""} ${slot.isReserved ? "reserved" : ""}`}
                    onClick={() => props.setSelectedSlotIndex(actualIndex)}
                    disabled={slot.isReserved}
                    aria-disabled={slot.isReserved}
                  >
                    <strong>{slot.dayLabel}</strong>
                    <span className="mono">{slot.timeLabel}</span>
                    {slot.isReserved && <small>Reserved</small>}
                  </button>
                );
              })}
            </div>
            {props.slots.length > 4 && (
              <button
                type="button"
                className="more-slots-toggle"
                onClick={() => setShowAllSlots((value) => !value)}
              >
                <ChevronDown style={{ transform: showAllSlots ? "rotate(180deg)" : "none" }} />
                {showAllSlots ? "Show fewer" : `${props.slots.length - 4} more times`}
              </button>
            )}
          </>
        )}
        {allReserved && (
          <div className="compat-card bad">
            <AlertTriangle />
            <span>All visible slots for this charger are already reserved.</span>
          </div>
        )}
      </div>

      <footer className="booking-summary">
        <div className="booking-summary-cost">
          <small>Estimated cost</small>
          <strong>{money(props.estimatedCost)}</strong>
        </div>
        {!props.hasEnoughBalance && (
          <div className="booking-summary-warning">
            <AlertTriangle />
            <span>Wallet balance is below the estimate. Top up to confirm this reservation.</span>
          </div>
        )}
        <button className="primary wide" type="submit" disabled={!props.canReserve}>
          Reserve this slot
        </button>
        <a
          className="booking-summary-route"
          href={googleMapsDirectionsUrl(props.selectedStation, props.routeOrigin)}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation /> Open turn-by-turn in Google Maps
        </a>
      </footer>

      <details className="quiet-details">
        <summary>Report an issue with this station</summary>
        <div className="issue-mini">
          <Input label="Category" value={props.issueForm.category} onChange={(value) => props.setIssueForm({ ...props.issueForm, category: value })} />
          <textarea value={props.issueForm.description} onChange={(event) => props.setIssueForm({ ...props.issueForm, description: event.target.value })} placeholder="Description (optional)" />
          <button className="secondary" type="button" onClick={() => props.onIssue()}>Send</button>
        </div>
      </details>
    </form>
  );
}
