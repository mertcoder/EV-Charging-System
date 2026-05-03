import { UserCircle, Zap } from "lucide-react";
import type { User, UserRole } from "../../shared/domain";

const roleLabels: Record<UserRole, string> = {
  EV_DRIVER: "Driver",
  STATION_OPERATOR: "Operator",
  ADMINISTRATOR: "Admin"
};

export function SignInScreen({ users, onSignIn }: { users: User[]; onSignIn: (userId: string) => void }) {
  const activeUsers = users.filter((user) => user.isActive);
  return (
    <main className="login-screen">
      <div className="login-panel">
        <div className="brand login-brand">
          <Zap />
          <div>
            <strong>Voltline</strong>
            <span>EV Charge Network</span>
          </div>
        </div>
        <h1>Choose a demo account</h1>
        <p>Switching accounts reloads vehicles, wallet, reservations, favorites and notifications for that user.</p>
        <div className="account-card-grid">
          {activeUsers.map((user) => (
            <button key={user.id} type="button" className="account-card" onClick={() => onSignIn(user.id)}>
              <UserCircle />
              <strong>{user.name}</strong>
              <span>{roleLabels[user.role]}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
