import type { FormEvent } from "react";
import { Bell, CreditCard, Lock, ShieldCheck, Star } from "lucide-react";
import type { BootstrapPayload } from "../../shared/domain";
import { Empty, Input, PanelTitle, SessionHistory, SimpleRow, Transactions } from "../../components/common";
import { money } from "../../lib/presentation";

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

export function NotificationPanel({ notifications }: { notifications: BootstrapPayload["notifications"] }) {
  return (
    <div className="side-panel">
      <PanelTitle icon={<Bell />} title="Notifications" />
      {notifications.length === 0 ? (
        <Empty text="No notifications yet." />
      ) : (
        <div className="compact-table">
          {notifications.slice(0, 6).map((notification) => (
            <div className="simple-row" key={notification.id}>
              <strong>{notification.type.replace(/_/g, " ")}</strong>
              <span>{notification.message}</span>
            </div>
          ))}
        </div>
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
