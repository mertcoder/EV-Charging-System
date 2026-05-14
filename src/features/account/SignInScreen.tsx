import { FormEvent, useMemo, useState } from "react";
import { Check, Eye, EyeOff, LogIn, Moon, Sun, UserCircle, UserPlus, Users, X, Zap } from "lucide-react";
import type { User, UserRole } from "../../shared/domain";
import { evaluatePassword, isPasswordStrong } from "../../shared/password";

const roleLabels: Record<UserRole, string> = {
  EV_DRIVER: "Driver",
  STATION_OPERATOR: "Operator",
  ADMINISTRATOR: "Admin"
};

type Mode = "signIn" | "signUp" | "demo";

const modeMeta: Record<Mode, { title: string; subtitle: string }> = {
  signIn: {
    title: "Welcome back",
    subtitle: "Sign in with the email and password you registered with."
  },
  signUp: {
    title: "Create your account",
    subtitle: "Choose a role and we will tailor the workspace to it."
  },
  demo: {
    title: "Use a demo account",
    subtitle: "Switch instantly to a pre-populated profile to explore each role."
  }
};

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  visible,
  onToggleVisible,
  inputId
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  placeholder?: string;
  visible: boolean;
  onToggleVisible: () => void;
  inputId: string;
}) {
  return (
    <label htmlFor={inputId}>
      {label}
      <div className="password-field">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </label>
  );
}

export function SignInScreen({
  users,
  onSignIn,
  onLogin,
  onRegister,
  theme,
  onToggleTheme
}: {
  users: User[];
  onSignIn: (userId: string) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: { name: string; email: string; password: string; role: UserRole }) => Promise<void>;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const activeUsers = users.filter((user) => user.isActive);
  const [mode, setMode] = useState<Mode>("signIn");
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "EV_DRIVER" as UserRole
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signInPasswordVisible, setSignInPasswordVisible] = useState(false);
  const [signUpPasswordVisible, setSignUpPasswordVisible] = useState(false);

  const passwordRules = useMemo(() => evaluatePassword(signUpForm.password), [signUpForm.password]);
  const passwordReady = isPasswordStrong(signUpForm.password);

  function selectMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submitSignIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onLogin(signInForm.email.trim(), signInForm.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitSignUp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!passwordReady) {
      setError("Please choose a stronger password that meets every rule below.");
      return;
    }
    setBusy(true);
    try {
      await onRegister({
        name: signUpForm.name.trim(),
        email: signUpForm.email.trim(),
        password: signUpForm.password,
        role: signUpForm.role
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }

  const meta = modeMeta[mode];

  return (
    <main className="login-screen">
      <button
        type="button"
        className="login-theme-toggle icon-button"
        onClick={onToggleTheme}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </button>
      <div className="login-panel">
        <div className="brand login-brand">
          <Zap />
          <div>
            <strong>Voltline</strong>
            <span>EV Charge Network</span>
          </div>
        </div>

        <div className="login-tabs" role="tablist" aria-label="Authentication options">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signIn"}
            className={mode === "signIn" ? "active" : ""}
            onClick={() => selectMode("signIn")}
          >
            <LogIn /> Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signUp"}
            className={mode === "signUp" ? "active" : ""}
            onClick={() => selectMode("signUp")}
          >
            <UserPlus /> Create account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "demo"}
            className={mode === "demo" ? "active" : ""}
            onClick={() => selectMode("demo")}
          >
            <Users /> Demo accounts
          </button>
        </div>

        <header className="login-heading">
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </header>

        {error && <div className="login-error" role="alert">{error}</div>}

        {mode === "signIn" && (
          <form className="clean-form login-form" onSubmit={submitSignIn}>
            <label htmlFor="signIn-email">
              Email
              <input
                id="signIn-email"
                type="email"
                autoComplete="email"
                required
                value={signInForm.email}
                onChange={(event) => setSignInForm({ ...signInForm, email: event.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <PasswordField
              inputId="signIn-password"
              label="Password"
              value={signInForm.password}
              onChange={(value) => setSignInForm({ ...signInForm, password: value })}
              autoComplete="current-password"
              placeholder="Your password"
              visible={signInPasswordVisible}
              onToggleVisible={() => setSignInPasswordVisible((current) => !current)}
            />
            <button type="submit" className="primary wide" disabled={busy}>
              <LogIn /> {busy ? "Signing in..." : "Sign in"}
            </button>
            <p className="login-foot">
              No account yet?{" "}
              <button type="button" className="link-button" onClick={() => selectMode("signUp")}>
                Create one
              </button>
              {" "}or{" "}
              <button type="button" className="link-button" onClick={() => selectMode("demo")}>
                use a demo account
              </button>
              .
            </p>
          </form>
        )}

        {mode === "signUp" && (
          <form className="clean-form login-form" onSubmit={submitSignUp}>
            <label htmlFor="signUp-name">
              Full name
              <input
                id="signUp-name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                value={signUpForm.name}
                onChange={(event) => setSignUpForm({ ...signUpForm, name: event.target.value })}
                placeholder="Ada Lovelace"
              />
            </label>
            <label htmlFor="signUp-email">
              Email
              <input
                id="signUp-email"
                type="email"
                autoComplete="email"
                required
                value={signUpForm.email}
                onChange={(event) => setSignUpForm({ ...signUpForm, email: event.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <PasswordField
              inputId="signUp-password"
              label="Password"
              value={signUpForm.password}
              onChange={(value) => setSignUpForm({ ...signUpForm, password: value })}
              autoComplete="new-password"
              placeholder="Choose a strong password"
              visible={signUpPasswordVisible}
              onToggleVisible={() => setSignUpPasswordVisible((current) => !current)}
            />
            <ul className="password-rules" aria-live="polite">
              {passwordRules.map((rule) => (
                <li key={rule.id} className={rule.passed ? "passed" : "pending"}>
                  {rule.passed ? <Check /> : <X />}
                  <span>{rule.label}</span>
                </li>
              ))}
            </ul>
            <label htmlFor="signUp-role">
              Role
              <select
                id="signUp-role"
                value={signUpForm.role}
                onChange={(event) => setSignUpForm({ ...signUpForm, role: event.target.value as UserRole })}
              >
                <option value="EV_DRIVER">Driver</option>
                <option value="STATION_OPERATOR">Operator</option>
                <option value="ADMINISTRATOR">Admin</option>
              </select>
            </label>
            <button type="submit" className="primary wide" disabled={busy || !passwordReady}>
              <UserPlus /> {busy ? "Creating account..." : "Create account"}
            </button>
            <p className="login-foot">
              Already have one?{" "}
              <button type="button" className="link-button" onClick={() => selectMode("signIn")}>
                Sign in
              </button>
              .
            </p>
          </form>
        )}

        {mode === "demo" && (
          <div className="account-card-grid">
            {activeUsers.map((user) => (
              <button key={user.id} type="button" className="account-card" onClick={() => onSignIn(user.id)}>
                <UserCircle />
                <strong>{user.name}</strong>
                <span>{roleLabels[user.role]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
