import type { ReactNode } from "react";
import { History, ReceiptText } from "lucide-react";
import type { BootstrapPayload, ChargingSession } from "../shared/domain";
import { money, statusLabel, transactionLabel } from "../lib/presentation";

export function Input({ label, value, onChange, type = "text", suffix }: { label: string; value: string; onChange: (value: string) => void; type?: string; suffix?: string }) {
  return (
    <label>
      <span>{label}</span>
      <div className={suffix ? "input-with-suffix" : ""}>
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="slider-field">
      <span>{label}: {value}%</span>
      <input type="range" min="0" max="100" step="5" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panel-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function SimpleRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="simple-row">
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
  );
}

export function SessionHistory({ sessions }: { sessions: ChargingSession[] }) {
  return (
    <div className="hero-panel wide-panel">
      <PanelTitle icon={<History />} title="Charging history" />
      {sessions.length === 0 ? (
        <Empty text="No completed sessions yet." />
      ) : (
        <div className="compact-table">
          {sessions.map((session) => (
            <div className="table-row" key={session.id}>
              <div>
                <strong>{session.reservation?.charger?.station?.name ?? "Charging session"}</strong>
                <span>
                  <span className="mono">{session.energyKwh} kWh</span> - <span className="mono">{money(session.totalCost)}</span> - {session.receiptNumber ?? "no receipt"}
                </span>
              </div>
              <span className={`status-pill status-${session.status.toLowerCase()}`}>{statusLabel(session.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Transactions({ data }: { data: BootstrapPayload }) {
  const transactions = data.wallet?.transactions ?? [];
  return (
    <div className="hero-panel wide-panel">
      <PanelTitle icon={<ReceiptText />} title="Transactions and receipts" />
      {transactions.length === 0 ? (
        <Empty text="No transactions yet." />
      ) : (
        <div className="compact-table">
          {transactions.map((transaction) => (
            <div className="table-row" key={transaction.id}>
              <div>
                <strong>{transactionLabel(transaction.type)}</strong>
                <span>{transaction.description}</span>
              </div>
              <div className="right-text">
                <strong className={`mono ${transaction.type === "TOP_UP" || transaction.type === "REFUND" ? "credit" : "debit"}`}>
                  {transaction.type === "TOP_UP" || transaction.type === "REFUND" ? "+" : "-"}{money(Math.abs(transaction.amount))}
                </strong>
                <span className="mono">{transaction.receiptNumber ?? "N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
