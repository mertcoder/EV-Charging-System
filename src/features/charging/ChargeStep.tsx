import type { FormEvent } from "react";
import { Activity, AlertTriangle, Clock, Gauge, RefreshCw, Zap } from "lucide-react";
import type { ChargingSession, Reservation } from "../../shared/domain";
import { Empty, Metric, PanelTitle, SessionHistory, Slider } from "../../components/common";
import { money, timeShort } from "../../lib/presentation";

export function ChargeStep(props: {
  reservations: Reservation[];
  confirmedReservations: Reservation[];
  activeSession?: ChargingSession;
  sessions: ChargingSession[];
  walletBalance: number;
  form: any;
  setForm: (form: any) => void;
  onStart: (event: FormEvent) => void;
  onComplete: (event: FormEvent) => void;
  onCancel: (reservation: Reservation) => void;
  onNoShow: (reservation: Reservation) => void;
  onSync: () => void;
}) {
  const activeVehicle = props.activeSession?.reservation?.vehicle;
  const targetSoc = Number(props.form.targetSoc || props.activeSession?.targetSoc || 80);
  const endSoc = Number(props.form.endSoc || targetSoc);
  const effectiveEndSoc = props.activeSession?.targetSoc ? Math.min(endSoc, props.activeSession.targetSoc) : endSoc;
  const liveEnergy =
    props.activeSession && activeVehicle ? Math.max(0, ((effectiveEndSoc - props.activeSession.startSoc) / 100) * activeVehicle.batteryCapacityKwh) : 0;
  const liveCost = liveEnergy * (props.activeSession?.unitPrice ?? 0);
  const progress = props.activeSession ? Math.max(0, Math.min(100, ((effectiveEndSoc - props.activeSession.startSoc) / Math.max(1, targetSoc - props.activeSession.startSoc)) * 100)) : 0;
  return (
    <section className="flow-grid">
      <div className="hero-panel">
        <h2>Start charging</h2>
        <p>Start a session from a confirmed reservation; live energy use and cost are tracked.</p>
        <form className="clean-form" onSubmit={props.onStart}>
          <label>
            Reservation
            <select value={props.form.reservationId} onChange={(event) => props.setForm({ ...props.form, reservationId: event.target.value })}>
              <option value="">Select reservation</option>
              {props.confirmedReservations.map((reservation) => (
                <option key={reservation.id} value={reservation.id}>
                  {reservation.charger?.station?.name} - {timeShort(reservation.startTime)}
                </option>
              ))}
            </select>
          </label>
          <Slider label="Start SoC" value={props.form.startSoc} onChange={(value) => props.setForm({ ...props.form, startSoc: value })} />
          <Slider label="Target SoC" value={props.form.targetSoc} onChange={(value) => props.setForm({ ...props.form, targetSoc: value })} />
          <button className="primary wide" type="submit">
            <Zap /> Start charging
          </button>
        </form>
      </div>
      <div className="side-panel">
        <PanelTitle icon={<Gauge />} title="Live session" />
        {props.activeSession ? (
          <div className="live-card">
            <Activity />
            <div>
              <strong>Charging in progress</strong>
              <span>{props.activeSession.reservation?.charger?.station?.name}</span>
              <small className="mono">SoC {props.activeSession.startSoc}% - {money(props.activeSession.unitPrice)}/kWh</small>
            </div>
          </div>
        ) : (
          <Empty text="No active session." />
        )}
        {props.activeSession && (
          <div className="session-progress">
            <div className="progress-topline">
              <span>Live estimate</span>
              <strong className="mono">{Math.round(progress)}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="mini-metrics compact">
              <Metric label="Energy" value={<span className="mono">{liveEnergy.toFixed(1)} kWh</span>} />
              <Metric label="Running cost" value={<span className="mono">{money(liveCost)}</span>} />
              <Metric label="Sync" value={props.activeSession.syncStatus} />
            </div>
            {props.walletBalance < liveCost && (
              <div className="compat-card bad">
                <AlertTriangle />
                <span>Wallet may deplete before the requested end SoC. The session will stop safely.</span>
              </div>
            )}
          </div>
        )}
        <form className="clean-form" onSubmit={props.onComplete}>
          <Slider label="End SoC" value={props.form.endSoc} onChange={(value) => props.setForm({ ...props.form, endSoc: value })} />
          <label className="check-row">
            <input type="checkbox" checked={props.form.connectivityLoss} onChange={(event) => props.setForm({ ...props.form, connectivityLoss: event.target.checked })} />
            Simulate connectivity loss
          </label>
          <label className="check-row">
            <input type="checkbox" checked={props.form.malfunction} onChange={(event) => props.setForm({ ...props.form, malfunction: event.target.checked })} />
            Simulate charger malfunction
          </label>
          <button className="secondary wide" type="button" onClick={props.onSync} disabled={!props.activeSession}>
            <RefreshCw /> Simulate sync recovery
          </button>
          <button className="primary wide" type="submit">
            Complete session
          </button>
        </form>
      </div>
      <div className="hero-panel wide-panel">
        <PanelTitle icon={<Clock />} title="Reservation management" />
        {props.reservations.length === 0 ? (
          <Empty text="No reservations yet." />
        ) : (
          <div className="compact-table">
            {props.reservations.map((reservation) => (
              <div className="table-row" key={reservation.id}>
                <div>
                  <strong>{reservation.charger?.station?.name ?? "Station"} - {reservation.charger?.code ?? "Charger"}</strong>
                  <span className="mono">{timeShort(reservation.startTime)} - {reservation.status} - estimate {money(reservation.estimatedCost)}</span>
                </div>
                <div className="row-actions">
                  {reservation.status === "CONFIRMED" && (
                    <>
                      <button className="secondary" type="button" onClick={() => props.onCancel(reservation)}>Cancel</button>
                      <button className="secondary" type="button" onClick={() => props.onNoShow(reservation)}>No-show</button>
                    </>
                  )}
                  <span className={`status-pill status-${reservation.status.toLowerCase().replace("_", "-")}`}>{reservation.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <SessionHistory sessions={props.sessions} />
    </section>
  );
}
