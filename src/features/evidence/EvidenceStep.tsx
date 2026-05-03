import { Activity, Bell, ShieldCheck } from "lucide-react";
import type { BootstrapPayload } from "../../shared/domain";
import { Empty, Input, Metric, PanelTitle } from "../../components/common";
import { CompliancePanel } from "../wallet/WalletStep";

export function EvidenceStep({ data, filter, setFilter }: { data: BootstrapPayload; filter: string; setFilter: (value: string) => void }) {
  const totalChargers = data.stations.reduce((sum, station) => sum + station.chargers.length, 0);
  const activeSessionCount = data.sessions.filter((session) => session.status === "ACTIVE").length;
  const openIssueCount = data.issues.filter((issue) => issue.status === "OPEN").length;
  const filteredAudit = filter
    ? data.audit.filter((row) => `${row.action} ${row.details}`.toLowerCase().includes(filter.toLowerCase()))
    : data.audit;

  return (
    <section className="evidence-layout">
      <div className="hero-panel">
        <PanelTitle icon={<Activity />} title="System summary" />
        <div className="stat-grid">
          <Metric label="Stations" value={<span className="mono">{data.stations.length}</span>} />
          <Metric label="Chargers" value={<span className="mono">{totalChargers}</span>} />
          <Metric label="Vehicles" value={<span className="mono">{data.vehicles.length}</span>} />
          <Metric label="Active sessions" value={<span className="mono">{activeSessionCount}</span>} />
          <Metric label="Open issues" value={<span className="mono">{openIssueCount}</span>} />
        </div>
        <Input label="Search activity" value={filter} onChange={setFilter} />
        <div className="audit-list">
          {filteredAudit.length === 0 ? (
            <Empty text="No records match this filter." />
          ) : (
            filteredAudit.slice(0, 30).map((row) => (
              <div className="audit-row" key={row.id}>
                <Bell />
                <div>
                  <strong>{row.action}</strong>
                  <span>{row.details}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <CompliancePanel title="Security and compliance evidence" />
      <div className="side-panel">
        <PanelTitle icon={<ShieldCheck />} title="Service status" />
        <div className="status-list">
          <div className="status-line"><span className="dot ok" /> API - healthy</div>
          <div className="status-line"><span className="dot ok" /> Payment gateway - healthy</div>
          <div className="status-line"><span className="dot ok" /> Map service - healthy</div>
          <div className="status-line"><span className="dot ok" /> Authentication - healthy</div>
        </div>
        <p className="soft-note">Monthly availability target is <span className="mono">99.5%</span>.</p>
      </div>
    </section>
  );
}
