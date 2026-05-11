import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, History, ReceiptText } from "lucide-react";
import type { BootstrapPayload, ChargingSession } from "../shared/domain";
import { money, statusLabel, transactionLabel } from "../lib/presentation";

function sessionDateLabel(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

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
        <Empty text="You haven't completed any charging sessions yet." />
      ) : (
        <div className="session-grid">
          {sessions.map((session) => {
            const statusKey = session.status.toLowerCase();
            const stationName = session.reservation?.charger?.station?.name ?? "Charging session";
            const chargerCode = session.reservation?.charger?.code;
            return (
              <article className={`session-card status-${statusKey}`} key={session.id}>
                <header className="session-card-header">
                  <div className="session-station">
                    <strong>{stationName}</strong>
                    <span>
                      {chargerCode ? `${chargerCode} · ` : ""}{sessionDateLabel(session.startTime)}
                    </span>
                  </div>
                  <span className={`status-pill status-${statusKey}`}>{statusLabel(session.status)}</span>
                </header>
                <div className="session-stats">
                  <div className="session-stat">
                    <small>Energy</small>
                    <strong>{session.energyKwh.toFixed(1)} kWh</strong>
                  </div>
                  <div className="session-stat">
                    <small>Total</small>
                    <strong>{money(session.totalCost)}</strong>
                  </div>
                  <div className="session-stat">
                    <small>{session.endSoc != null ? "Charged to" : "Started at"}</small>
                    <strong>{session.endSoc != null ? `${session.endSoc}%` : `${session.startSoc}%`}</strong>
                  </div>
                </div>
                <div className="session-receipt">
                  <span>Receipt</span>
                  <code>{session.receiptNumber ?? "Not generated"}</code>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TRANSACTIONS_PAGE_SIZE = 6;

export function Transactions({ data }: { data: BootstrapPayload }) {
  const transactions = data.wallet?.transactions ?? [];
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(transactions.length / TRANSACTIONS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => transactions.slice(safePage * TRANSACTIONS_PAGE_SIZE, (safePage + 1) * TRANSACTIONS_PAGE_SIZE),
    [transactions, safePage]
  );

  return (
    <div className="hero-panel wide-panel">
      <PanelTitle icon={<ReceiptText />} title="Transactions and receipts" />
      {transactions.length === 0 ? (
        <Empty text="No transactions yet." />
      ) : (
        <>
          <ul className="transaction-list">
            {pageItems.map((transaction) => {
              const isCredit = transaction.type === "TOP_UP" || transaction.type === "REFUND";
              return (
                <li className="transaction-row" key={transaction.id}>
                  <div className="transaction-row-main">
                    <strong>{transactionLabel(transaction.type)}</strong>
                    <span>{transaction.description}</span>
                  </div>
                  <div className="transaction-row-amount">
                    <strong className={`mono ${isCredit ? "credit" : "debit"}`}>
                      {isCredit ? "+" : "-"}{money(Math.abs(transaction.amount))}
                    </strong>
                    <span className="mono">{transaction.receiptNumber ?? "N/A"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  const maxButtons = 5;
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(0, page - half);
  let end = Math.min(totalPages, start + maxButtons);
  if (end - start < maxButtons) start = Math.max(0, end - maxButtons);
  const visible: number[] = [];
  for (let i = start; i < end; i += 1) visible.push(i);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination-step"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </button>
      {start > 0 && (
        <>
          <button type="button" className="pagination-num" onClick={() => onChange(0)}>1</button>
          {start > 1 && <span className="pagination-ellipsis">…</span>}
        </>
      )}
      {visible.map((index) => (
        <button
          key={index}
          type="button"
          className={`pagination-num ${index === page ? "active" : ""}`}
          onClick={() => onChange(index)}
          aria-current={index === page ? "page" : undefined}
        >
          {index + 1}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
          <button type="button" className="pagination-num" onClick={() => onChange(totalPages - 1)}>{totalPages}</button>
        </>
      )}
      <button
        type="button"
        className="pagination-step"
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        aria-label="Next page"
      >
        <ChevronRight />
      </button>
    </nav>
  );
}
