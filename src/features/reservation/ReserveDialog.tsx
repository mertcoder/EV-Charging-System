import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Navigation, Star, X } from "lucide-react";
import type { Charger, ChargingStation, Vehicle } from "../../shared/domain";
import type { Coordinates } from "../../shared/geo";
import type { Slot } from "../../lib/presentation";
import { googleMapsDirectionsUrl, money } from "../../lib/presentation";
import { Empty, Input } from "../../components/common";

export interface ReserveDialogProps {
  open: boolean;
  onClose: () => void;
  station: ChargingStation;
  selectedCharger?: Charger;
  selectedVehicle?: Vehicle;
  slots: Slot[];
  selectedSlotIndex: number;
  estimatedCost: number;
  walletBalance: number;
  isFavorite: boolean;
  routeOrigin: Coordinates;
  selectedDurationMinutes: number;
  setSelectedChargerId: (id: string) => void;
  setSelectedSlotIndex: (index: number) => void;
  setSelectedDurationMinutes: (minutes: number) => void;
  onReserve: (event: FormEvent) => void;
  onFavorite: () => void;
  issueForm: { category: string; description: string };
  setIssueForm: (form: { category: string; description: string }) => void;
  onIssue: (event?: FormEvent) => void;
}

export function ReserveDialog(props: ReserveDialogProps) {
  const [showAllSlots, setShowAllSlots] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [props.open, props.onClose]);

  useEffect(() => {
    if (!props.open) setShowAllSlots(false);
  }, [props.open]);

  if (!props.open) return null;

  const compatibility =
    props.selectedVehicle && props.selectedCharger
      ? props.selectedVehicle.connectorType === props.selectedCharger.connectorType
      : false;
  const hasEnoughBalance = props.walletBalance >= props.estimatedCost;
  const selectedSlot = props.slots[props.selectedSlotIndex];
  const canReserve = Boolean(
    props.selectedVehicle && props.selectedCharger && selectedSlot && !selectedSlot.isReserved && compatibility && hasEnoughBalance
  );
  const visibleSlots = showAllSlots ? props.slots : props.slots.slice(0, 4);
  const allReserved = props.slots.length > 0 && props.slots.every((slot) => slot.isReserved);
  const firstCompatible = props.station.chargers.find((c) => c.connectorType === props.selectedVehicle?.connectorType);

  function submit(event: FormEvent) {
    event.preventDefault();
    props.onReserve(event);
  }

  return (
    <div
      className="modal-overlay reserve-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-dialog-title"
      onClick={props.onClose}
    >
      <form className="reserve-dialog-card" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <header className="reserve-dialog-header">
          <div className="station-heading">
            <div>
              <div className="station-title-line">
                <h2 id="reserve-dialog-title">{props.station.name}</h2>
                {props.isFavorite && <span className="status-pill favorite-status">Favorite</span>}
              </div>
              <p>{props.station.address}</p>
            </div>
            <div className="reserve-dialog-header-actions">
              <button
                type="button"
                className={`favorite-action ${props.isFavorite ? "active" : ""}`}
                onClick={props.onFavorite}
                aria-pressed={props.isFavorite}
                title={props.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star fill={props.isFavorite ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                className="reserve-dialog-close"
                onClick={props.onClose}
                aria-label="Close"
                title="Close"
              >
                <X />
              </button>
            </div>
          </div>
        </header>

        <div className="reserve-dialog-body">
          <div className="booking-section">
            <div className="booking-section-label-row">
              <span className="booking-section-label">Your match</span>
              <span className={`match-status-pill ${compatibility ? "ok" : "bad"}`}>
                {compatibility ? <Check /> : <AlertTriangle />}
                {compatibility ? "Compatible" : "Incompatible"}
              </span>
            </div>
            <div className="match-card single">
              <div className="match-side">
                <small>Charger</small>
                <select
                  value={props.selectedCharger?.id ?? ""}
                  onChange={(event) => props.setSelectedChargerId(event.target.value)}
                >
                  {props.station.chargers.map((charger) => (
                    <option key={charger.id} value={charger.id}>
                      {charger.code}
                    </option>
                  ))}
                </select>
                <span className="match-meta">
                  {props.selectedCharger?.connectorType} · {props.selectedCharger?.powerKw}kW
                </span>
              </div>
              <div className="match-side">
                <small>Vehicle</small>
                <strong>
                  {props.selectedVehicle ? `${props.selectedVehicle.brand} ${props.selectedVehicle.modelName}` : "—"}
                </strong>
                <span className="match-meta">{props.selectedVehicle?.connectorType ?? "—"}</span>
              </div>
            </div>
            {!compatibility && firstCompatible && (
              <button
                type="button"
                className="secondary subtle match-suggest"
                onClick={() => props.setSelectedChargerId(firstCompatible.id)}
              >
                Use compatible charger ({firstCompatible.code})
              </button>
            )}
            {!compatibility && !firstCompatible && (
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
                  {visibleSlots.map((slot) => {
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
        </div>

        <footer className="booking-summary reserve-dialog-footer">
          <div className="booking-summary-cost">
            <small>Estimated cost</small>
            <strong>{money(props.estimatedCost)}</strong>
          </div>
          {!hasEnoughBalance && (
            <div className="booking-summary-warning">
              <AlertTriangle />
              <span>Wallet balance is below the estimate. Top up to confirm this reservation.</span>
            </div>
          )}
          <button className="primary wide" type="submit" disabled={!canReserve}>
            Reserve this slot
          </button>
          <a
            className="booking-summary-route"
            href={googleMapsDirectionsUrl(props.station, props.routeOrigin)}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation /> Open turn-by-turn in Google Maps
          </a>
        </footer>

        <details className="quiet-details reserve-dialog-issue">
          <summary>Report an issue with this station</summary>
          <div className="issue-mini">
            <Input
              label="Category"
              value={props.issueForm.category}
              onChange={(value) => props.setIssueForm({ ...props.issueForm, category: value })}
            />
            <textarea
              value={props.issueForm.description}
              onChange={(event) => props.setIssueForm({ ...props.issueForm, description: event.target.value })}
              placeholder="Description (optional)"
            />
            <button className="secondary" type="button" onClick={() => props.onIssue()}>Send</button>
          </div>
        </details>
      </form>
    </div>
  );
}
