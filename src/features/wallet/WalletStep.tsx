import { useMemo, useState, type FormEvent } from "react";
import { Bell, CreditCard, Lock, ShieldCheck, Star } from "lucide-react";
import type { BootstrapPayload } from "../../shared/domain";
import { Empty, Input, Pagination, PanelTitle, SessionHistory, SimpleRow, Transactions } from "../../components/common";
import { money } from "../../lib/presentation";

const NOTIFICATIONS_PAGE_SIZE = 6;

export function WalletStep({ data, topUpAmount, setTopUpAmount, onTopUp }: { data: BootstrapPayload; topUpAmount: string; setTopUpAmount: (value: string) => void; onTopUp: (event: FormEvent) => void }) {
  if (!data.wallet) {
    return (
      <div className="locked-panel">
        <Lock />
        <h2>Driver wallet required</h2>
        <p>Wallet, receipts, favorites and charging history are available when a driver account is active.</p>
      </div>
    );
  }

  return (
    <section className="flow-grid">
      <div className="hero-panel wallet-hero">
        <span className="eyebrow">Balance</span>
        <div className="wallet-balance mono">{money(data.wallet.balance)}</div>
        <form className="inline-action" onSubmit={onTopUp}>
          <Input label="Top-up amount" value={topUpAmount} onChange={setTopUpAmount} type="number" suffix="TL" />
          <button className="primary" type="submit">
            <CreditCard /> Top up
          </button>
        </form>
      </div>
      <div className="side-panel">
        <PanelTitle icon={<Star />} title="Favorites" />
        {data.favorites.length ? data.favorites.map((favorite) => <SimpleRow key={favorite.id} title={favorite.station?.name ?? "Station"} subtitle="Favorite station" />) : <Empty text="No favorites yet." />}
      </div>
      <NotificationPanel notifications={data.notifications} />
      <Transactions data={data} />
      <SessionHistory sessions={data.sessions} />
    </section>
  );
}

function notificationLabel(type: string) {
  return ({
    RESERVATION_CONFIRMED: "Reservation confirmed",
    RESERVATION_CANCELLED: "Reservation cancelled",
    RESERVATION_NO_SHOW: "Missed reservation",
    CHARGING_STARTED: "Charging started",
    CHARGING_COMPLETED: "Charging complete",
    CHARGING_INTERRUPTED: "Charging interrupted",
    LOW_BALANCE: "Low balance",
    WALLET_TOPPED_UP: "Wallet topped up",
    REFUND_ISSUED: "Refund issued",
    SECURITY_ALERT: "Security alert",
    AVAILABILITY_UPDATE: "Availability update"
  } as Record<string, string>)[type] ?? type.replace(/_/g, " ").toLowerCase();
}

function notificationTone(type: string): "ok" | "warn" | "info" {
  if (["LOW_BALANCE", "RESERVATION_CANCELLED", "RESERVATION_NO_SHOW", "CHARGING_INTERRUPTED", "SECURITY_ALERT"].includes(type)) return "warn";
  if (["CHARGING_COMPLETED", "WALLET_TOPPED_UP", "REFUND_ISSUED", "RESERVATION_CONFIRMED"].includes(type)) return "ok";
  return "info";
}

export function NotificationPanel({ notifications }: { notifications: BootstrapPayload["notifications"] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(notifications.length / NOTIFICATIONS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => notifications.slice(safePage * NOTIFICATIONS_PAGE_SIZE, (safePage + 1) * NOTIFICATIONS_PAGE_SIZE),
    [notifications, safePage]
  );

  return (
    <div className="hero-panel wide-panel">
      <PanelTitle icon={<Bell />} title="Notifications" />
      {notifications.length === 0 ? (
        <Empty text="No notifications yet." />
      ) : (
        <>
          <ul className="notification-list">
            {pageItems.map((notification) => {
              const tone = notificationTone(notification.type);
              return (
                <li className={`notification-item tone-${tone}`} key={notification.id}>
                  <span className={`notification-dot dot-${tone}`} aria-hidden />
                  <div className="notification-body">
                    <strong>{notificationLabel(notification.type)}</strong>
                    <span>{notification.message}</span>
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

export function CompliancePanel({ title = "Compliance controls" }: { title?: string }) {
  return (
    <div className="side-panel">
      <PanelTitle icon={<ShieldCheck />} title={title} />
      <div className="status-list">
        <div className="status-line"><span className="dot ok" /> Digital receipts retained for every transaction</div>
        <div className="status-line"><span className="dot ok" /> Wallet changes are auditable and retrievable</div>
        <div className="status-line"><span className="dot ok" /> Payment gateway contract requires HTTPS / TLS 1.2+</div>
        <div className="status-line"><span className="dot ok" /> Role-based access protects admin and operator data</div>
      </div>
    </div>
  );
}
