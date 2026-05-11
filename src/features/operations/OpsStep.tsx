import type { FormEvent } from "react";
import { AlertTriangle, BarChart3, Clock, Lock, MapPinned, Plus, RefreshCw, Trash2, UserCog, Wrench } from "lucide-react";
import type { BootstrapPayload, Charger, ChargerStatus, ChargingStation, IssueReport, UserRole } from "../../shared/domain";
import type { ReportsPayload, StationDraft, StationFormState } from "../../appTypes";
import { Empty, Input, Metric, PanelTitle, SimpleRow } from "../../components/common";
import { money, timeShort } from "../../lib/presentation";
import { LocationPicker } from "./LocationPicker";

const mapApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function OpsStep(props: {
  role: UserRole;
  data: BootstrapPayload;
  reports: ReportsPayload | null;
  stationForm: StationFormState;
  setStationForm: (form: StationFormState) => void;
  stationDrafts: Record<string, StationDraft>;
  setStationDrafts: (drafts: Record<string, StationDraft>) => void;
  selectedConfigStationId: string;
  setSelectedConfigStationId: (stationId: string) => void;
  chargerPriceDrafts: Record<string, string>;
  setChargerPriceDrafts: (drafts: Record<string, string>) => void;
  onUpdateCharger: (charger: Charger, status: ChargerStatus, pricePerKwh?: number) => void;
  onUpdateStation: (station: ChargingStation) => void;
  onUpdateIssue: (issue: IssueReport, status: string) => void;
  onReports: () => void;
  onSecurity: () => void;
  onAddStation: (event: FormEvent) => void;
  onDeleteStation: (station: ChargingStation) => void;
  onUpdateUser: (userId: string, changes: { role?: UserRole; isActive?: boolean }) => void;
}) {
  if (!["STATION_OPERATOR", "ADMINISTRATOR"].includes(props.role)) {
    return (
      <div className="locked-panel">
        <Lock />
        <h2>Authorized access required</h2>
        <p>This area is available to operators and administrators. Use the role switch in the top bar.</p>
      </div>
    );
  }

  const selectedConfigStation = props.data.stations.find((station) => station.id === props.selectedConfigStationId) ?? props.data.stations[0];
  const selectedDraft = selectedConfigStation
    ? props.stationDrafts[selectedConfigStation.id] ?? {
        name: selectedConfigStation.name,
        address: selectedConfigStation.address,
        operatingStart: selectedConfigStation.operatingStart,
        operatingEnd: selectedConfigStation.operatingEnd,
        status: selectedConfigStation.status
      }
    : null;
  const securityAlerts = props.data.notifications.filter((notification) => notification.type === "SECURITY_ALERT").slice(0, 3);

  return (
    <section className="ops-grid">
      <div className="hero-panel">
        <PanelTitle icon={<Wrench />} title="Chargers" />
        <div className="charger-grid">
          {props.data.stations.flatMap((station) =>
            station.chargers.map((charger) => {
              const draftStr = props.chargerPriceDrafts[charger.id];
              const draftNum = Number(draftStr);
              const hasDraft = draftStr !== undefined && draftStr !== "" && !Number.isNaN(draftNum) && draftNum !== charger.pricePerKwh;
              const delta = hasDraft ? draftNum - charger.pricePerKwh : 0;
              const pct = hasDraft && charger.pricePerKwh > 0 ? (delta / charger.pricePerKwh) * 100 : 0;
              const direction = delta > 0 ? "up" : "down";
              const statusKey = charger.status.toLowerCase().replace("_", "-");
              return (
                <article className={`charger-card status-${statusKey}`} key={charger.id}>
                  <header className="charger-card-header">
                    <div className="charger-card-identity">
                      <span className="charger-card-station">{station.name}</span>
                      <strong className="charger-card-name">{charger.code}</strong>
                      <span className="charger-card-meta">
                        {charger.connectorType.replace("_", " ")} · {charger.powerKw} kW
                      </span>
                    </div>
                    <span className={`status-pill status-${statusKey}`}>
                      {charger.status.replace("_", " ").toLowerCase()}
                    </span>
                  </header>
                  <div className="charger-card-current">
                    <small>Current price</small>
                    <strong>{money(charger.pricePerKwh)}<em>/kWh</em></strong>
                  </div>
                  <div className="charger-card-controls">
                    <label className="charger-card-field">
                      <span>New price</span>
                      <div className="input-with-suffix wide-price">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.1"
                          value={props.chargerPriceDrafts[charger.id] ?? String(charger.pricePerKwh)}
                          onChange={(event) => props.setChargerPriceDrafts({ ...props.chargerPriceDrafts, [charger.id]: event.target.value })}
                        />
                        <em>TL</em>
                      </div>
                    </label>
                    <label className="charger-card-field">
                      <span>Status</span>
                      <select value={charger.status} onChange={(event) => props.onUpdateCharger(charger, event.target.value as ChargerStatus, Number(props.chargerPriceDrafts[charger.id] ?? charger.pricePerKwh))}>
                        <option value="AVAILABLE">Available</option>
                        <option value="IN_USE">In use</option>
                        <option value="RESERVED">Reserved</option>
                        <option value="OUT_OF_SERVICE">Out of service</option>
                      </select>
                    </label>
                  </div>
                  {hasDraft && (
                    <div className={`price-diff price-diff-${direction}`} aria-live="polite">
                      <span className="mono">{money(charger.pricePerKwh)}</span>
                      <span aria-hidden>→</span>
                      <strong className="mono">{money(draftNum)}</strong>
                      <em className="mono">
                        {delta > 0 ? "+" : ""}{money(delta)} ({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)
                      </em>
                    </div>
                  )}
                  <button
                    className="primary charger-save-btn"
                    type="button"
                    onClick={() => props.onUpdateCharger(charger, charger.status, Number(props.chargerPriceDrafts[charger.id] ?? charger.pricePerKwh))}
                    disabled={!hasDraft}
                  >
                    {hasDraft ? "Save changes" : "No changes"}
                  </button>
                </article>
              );
            })
          )}
        </div>
      </div>

      <div className="side-panel">
        <PanelTitle icon={<AlertTriangle />} title="Issue reports" />
        {props.data.issues.length === 0 ? (
          <Empty text="No open reports." />
        ) : (
          props.data.issues.map((issue) => (
            <div className="table-row" key={issue.id}>
              <div>
                <strong>{issue.category}</strong>
                <span>{issue.station?.name}</span>
              </div>
              <select value={issue.status} onChange={(event) => props.onUpdateIssue(issue, event.target.value)}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          ))
        )}
      </div>

      <div className="hero-panel wide-panel">
        <PanelTitle icon={<MapPinned />} title="Station configuration" />
        {selectedConfigStation && selectedDraft ? (
          <div className="config-card station-config-single">
            <label>
              Select station
              <select value={selectedConfigStation.id} onChange={(event) => props.setSelectedConfigStationId(event.target.value)}>
                {props.data.stations.map((station) => (
                  <option key={station.id} value={station.id}>{station.name}</option>
                ))}
              </select>
            </label>
            <Input label="Station name" value={selectedDraft.name} onChange={(value) => props.setStationDrafts({ ...props.stationDrafts, [selectedConfigStation.id]: { ...selectedDraft, name: value } })} />
            <Input label="Address" value={selectedDraft.address} onChange={(value) => props.setStationDrafts({ ...props.stationDrafts, [selectedConfigStation.id]: { ...selectedDraft, address: value } })} />
            <div className="inline-fields">
              <Input label="Opens" type="time" value={selectedDraft.operatingStart} onChange={(value) => props.setStationDrafts({ ...props.stationDrafts, [selectedConfigStation.id]: { ...selectedDraft, operatingStart: value } })} />
              <Input label="Closes" type="time" value={selectedDraft.operatingEnd} onChange={(value) => props.setStationDrafts({ ...props.stationDrafts, [selectedConfigStation.id]: { ...selectedDraft, operatingEnd: value } })} />
            </div>
            <label>
              Station status
              <select value={selectedDraft.status} onChange={(event) => props.setStationDrafts({ ...props.stationDrafts, [selectedConfigStation.id]: { ...selectedDraft, status: event.target.value as ChargingStation["status"] } })}>
                <option value="AVAILABLE">Available</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
            <button className="secondary wide" type="button" onClick={() => props.onUpdateStation(selectedConfigStation)}>Save station</button>
          </div>
        ) : (
          <Empty text="No stations available." />
        )}
      </div>

      <div className="hero-panel wide-panel">
        <PanelTitle icon={<Clock />} title="Upcoming reservations" />
        {props.data.reservations.length === 0 ? (
          <Empty text="No reservations in the system." />
        ) : (
          <div className="compact-table">
            {props.data.reservations.slice(0, 8).map((reservation) => (
              <div className="table-row" key={reservation.id}>
                <div>
                  <strong>{reservation.charger?.station?.name ?? "Station"} - {reservation.charger?.code ?? "Charger"}</strong>
                  <span>{reservation.vehicle?.brand} {reservation.vehicle?.modelName} - <span className="mono">{timeShort(reservation.startTime)}</span></span>
                </div>
                <span className={`status-pill status-${reservation.status.toLowerCase().replace("_", "-")}`}>{reservation.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hero-panel wide-panel">
        <div className="panel-row">
          <PanelTitle icon={<BarChart3 />} title="Reports and occupancy" />
          <button className="secondary" onClick={props.onReports}>
            <RefreshCw /> Refresh
          </button>
        </div>
        {props.reports ? <ReportsPanel reports={props.reports} /> : <Empty text="Reports are loading." />}
      </div>

      {props.role === "ADMINISTRATOR" && (
        <>
          <div className="hero-panel wide-panel">
            <PanelTitle icon={<Plus />} title="Admin station management" />
            <div className="station-mode-toggle" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={props.stationForm.mode === "new"}
                className={props.stationForm.mode === "new" ? "active" : ""}
                onClick={() => props.setStationForm({ ...props.stationForm, mode: "new" })}
              >
                New station + first charger
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={props.stationForm.mode === "existing"}
                className={props.stationForm.mode === "existing" ? "active" : ""}
                onClick={() => props.setStationForm({ ...props.stationForm, mode: "existing" })}
              >
                Add charger to existing station
              </button>
            </div>
            <form className="clean-form" onSubmit={props.onAddStation}>
              {props.stationForm.mode === "new" ? (
                <>
                  <div className="inline-fields">
                    <Input label="Station name" value={props.stationForm.name} onChange={(value) => props.setStationForm({ ...props.stationForm, name: value })} />
                    <Input label="Address" value={props.stationForm.address} onChange={(value) => props.setStationForm({ ...props.stationForm, address: value })} />
                  </div>
                  <label>
                    <span>Location</span>
                    <LocationPicker
                      apiKey={mapApiKey}
                      value={
                        props.stationForm.latitude && props.stationForm.longitude
                          ? { lat: Number(props.stationForm.latitude), lng: Number(props.stationForm.longitude) }
                          : null
                      }
                      onChange={({ lat, lng }) =>
                        props.setStationForm({
                          ...props.stationForm,
                          latitude: lat.toFixed(6),
                          longitude: lng.toFixed(6)
                        })
                      }
                    />
                    <small className="soft-note">
                      {props.stationForm.latitude && props.stationForm.longitude
                        ? `Selected location: ${Number(props.stationForm.latitude).toFixed(4)}, ${Number(props.stationForm.longitude).toFixed(4)}`
                        : "Click on the map to place the station."}
                    </small>
                  </label>
                  <div className="inline-fields">
                    <Input label="Opens" type="time" value={props.stationForm.operatingStart} onChange={(value) => props.setStationForm({ ...props.stationForm, operatingStart: value })} />
                    <Input label="Closes" type="time" value={props.stationForm.operatingEnd} onChange={(value) => props.setStationForm({ ...props.stationForm, operatingEnd: value })} />
                  </div>
                </>
              ) : (
                <label>
                  <span>Station</span>
                  <select
                    value={props.stationForm.existingStationId}
                    onChange={(event) => props.setStationForm({ ...props.stationForm, existingStationId: event.target.value })}
                  >
                    <option value="">Select a station</option>
                    {props.data.stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name} ({station.chargers.length} chargers)
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="inline-fields">
                <Input label="Charger code (optional)" value={props.stationForm.chargerCode} onChange={(value) => props.setStationForm({ ...props.stationForm, chargerCode: value })} />
                <Input label="Power" suffix="kW" type="number" value={props.stationForm.powerKw} onChange={(value) => props.setStationForm({ ...props.stationForm, powerKw: value })} />
              </div>
              <small className="soft-note">Leave the charger code blank to auto-generate one (e.g. &quot;DC 50kW #02&quot;).</small>
              <div className="inline-fields">
                <label>
                  Charger type
                  <select value={props.stationForm.chargerType} onChange={(event) => props.setStationForm({ ...props.stationForm, chargerType: event.target.value })}>
                    <option value="AC">AC</option>
                    <option value="DC">DC</option>
                  </select>
                </label>
                <label>
                  Connector
                  <select value={props.stationForm.connectorType} onChange={(event) => props.setStationForm({ ...props.stationForm, connectorType: event.target.value })}>
                    <option value="CCS">CCS</option>
                    <option value="TYPE_2">Type 2</option>
                    <option value="CHADEMO">CHAdeMO</option>
                  </select>
                </label>
              </div>
              <Input label="Price per kWh" suffix="TL" type="number" value={props.stationForm.pricePerKwh} onChange={(value) => props.setStationForm({ ...props.stationForm, pricePerKwh: value })} />
              <button className="primary wide" type="submit">
                <Plus /> {props.stationForm.mode === "new" ? "Add station and first charger" : "Add charger to station"}
              </button>
            </form>
            <div className="compact-table spacious">
              {props.data.stations.map((station) => (
                <div className="table-row" key={station.id}>
                  <div>
                    <strong>{station.name}</strong>
                    <span>{station.chargers.length} {station.chargers.length === 1 ? "charger" : "chargers"} - {station.status}</span>
                  </div>
                  <button className="secondary" type="button" onClick={() => props.onDeleteStation(station)}>
                    <Trash2 /> Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-panel wide-panel">
            <PanelTitle icon={<UserCog />} title="User and operator management" />
            <div className="compact-table">
              {props.data.users.map((user) => (
                <div className="table-row" key={user.id}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="row-actions">
                    <select value={user.role} onChange={(event) => props.onUpdateUser(user.id, { role: event.target.value as UserRole })}>
                      <option value="EV_DRIVER">Driver</option>
                      <option value="STATION_OPERATOR">Operator</option>
                      <option value="ADMINISTRATOR">Admin</option>
                    </select>
                    <button className="secondary" type="button" onClick={() => props.onUpdateUser(user.id, { isActive: !user.isActive })}>
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="secondary" onClick={props.onSecurity}>
              <Lock /> Trigger failed-login alert
            </button>
            <div className="security-alert-panel">
              <strong>Recent security alerts</strong>
              {securityAlerts.length === 0 ? (
                <span>No failed-login threshold alerts yet.</span>
              ) : (
                securityAlerts.map((notification) => (
                  <span key={notification.id}>{notification.message}</span>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ReportsPanel({ reports }: { reports: ReportsPayload }) {
  const peakRows = Object.entries(reports.peakHours).sort(([a], [b]) => a.localeCompare(b));
  const chargerStatusRows = Object.entries(reports.chargerStatus);
  const issueStatusRows = Object.entries(reports.issueStatus);

  return (
    <>
      <div className="stat-grid">
        <Metric label="Revenue" value={<span className="mono">{money(reports.revenue)}</span>} />
        <Metric label="Users" value={<span className="mono">{reports.userActivity.users}</span>} />
        <Metric label="Reservations" value={<span className="mono">{reports.userActivity.reservations}</span>} />
        <Metric label="Cancellations" value={<span className="mono">{reports.userActivity.cancellations}</span>} />
        <Metric label="Availability" value={<span className="mono">99.5%</span>} />
      </div>
      <div className="report-grid">
        <div className="report-block">
          <h3>Station utilization</h3>
          <div className="compact-table">
            {reports.utilization.map((row) => (
              <div className="table-row" key={row.stationId}>
                <div>
                  <strong>{row.stationName}</strong>
                  <span>{row.sessions} sessions across {row.chargers} chargers</span>
                </div>
                <span className="mono">{row.utilizationRate}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="report-block">
          <h3>Peak charging hours</h3>
          {peakRows.length === 0 ? (
            <Empty text="No completed sessions yet." />
          ) : (
            <div className="compact-table">
              {peakRows.map(([hour, count]) => (
                <div className="table-row" key={hour}>
                  <strong className="mono">{hour}</strong>
                  <span>{count} sessions</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="report-block">
          <h3>Operational status</h3>
          <div className="compact-table">
            {chargerStatusRows.map(([status, count]) => (
              <div className="table-row" key={status}>
                <strong>{status}</strong>
                <span className="mono">{count}</span>
              </div>
            ))}
            {issueStatusRows.map(([status, count]) => (
              <div className="table-row" key={`issue-${status}`}>
                <strong>Issues {status}</strong>
                <span className="mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="report-block">
          <h3>User activity</h3>
          <div className="compact-table">
            <SimpleRow title="No-shows" subtitle={String(reports.userActivity.noShows)} />
            <SimpleRow title="Completed sessions" subtitle={String(reports.userActivity.completedSessions)} />
            <SimpleRow title="Interrupted sessions" subtitle={String(reports.userActivity.interruptedSessions)} />
            <SimpleRow title="Open maintenance issues" subtitle={String(reports.userActivity.maintenanceIssues)} />
          </div>
        </div>
      </div>
      <p className="soft-note">{reports.availabilityTarget}</p>
    </>
  );
}
