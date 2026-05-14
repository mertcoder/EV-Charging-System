import { useState } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  Car,
  ChevronDown,
  Clock,
  CreditCard,
  Database,
  FileText,
  Gauge,
  KeyRound,
  LifeBuoy,
  Mail,
  MapPinned,
  MessageSquare,
  Phone,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Star,
  TerminalSquare,
  Trash2,
  UserCog,
  Wallet,
  Wrench,
  Zap
} from "lucide-react";
import type { UserRole } from "../../shared/domain";

interface HelpSection {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

export function HelpStep({ role }: { role: UserRole }) {
  if (role === "EV_DRIVER") return <DriverHelp />;
  if (role === "STATION_OPERATOR") return <OperatorHelp />;
  return <AdminHelp />;
}

function DriverHelp() {
  const sections: HelpSection[] = [
    {
      icon: <Car />,
      title: "1. Add your vehicle",
      body: (
        <>
          Open <strong>My EV</strong> in the sidebar. Pick a brand and model from the suggestions — battery
          capacity and connector type fill in automatically. Type your plate number using the format
          <em> 35 EV 2024</em> and tap <strong>Save Vehicle</strong>. You can save more than one vehicle and
          switch between them later.
        </>
      )
    },
    {
      icon: <MapPinned />,
      title: "2. Find a charger",
      body: (
        <>
          Go to <strong>Find Charger</strong>. The map shows nearby stations colour-coded by availability
          (green = available, gold = occupied, red = offline). Use the filters above the map to narrow by
          connector, power, or maximum price. Click a marker or a card in the strip to load station details.
        </>
      )
    },
    {
      icon: <PlugZap />,
      title: "3. Reserve a slot",
      body: (
        <>
          In the booking panel, check that the compatibility pill says <em>Compatible</em>. If it says
          <em> Incompatible</em>, tap <strong>Use compatible charger</strong> to switch to a matching one
          automatically. Choose a duration (30, 60, 90, or 120 min) and pick one of the suggested time slots.
          Confirm with <strong>Reserve this slot</strong>.
        </>
      )
    },
    {
      icon: <Zap />,
      title: "4. Start charging",
      body: (
        <>
          When you arrive, open <strong>Charging</strong>, pick your reservation from the dropdown, set your
          starting state of charge, then tap <strong>Start charging</strong>. The live session card shows
          progress, energy used, and running cost. Tap <strong>Complete session</strong> when done — your
          wallet is charged and a receipt is created automatically.
        </>
      )
    },
    {
      icon: <Wallet />,
      title: "5. Manage your wallet",
      body: (
        <>
          The <strong>Wallet</strong> screen shows your balance, recent transactions, favourite stations, and
          notifications. Top up at any time using the form at the top. If your balance is below the estimated
          cost of a reservation, you'll see a warning before confirming.
        </>
      )
    }
  ];

  const faqs: FaqItem[] = [
    {
      q: "What if my connector doesn't match the charger?",
      a: "The booking panel checks this for you. If your vehicle's connector and the selected charger don't match, the compatibility pill turns red and a suggestion appears to switch to a compatible charger at the same station."
    },
    {
      q: "Can I cancel a reservation?",
      a: "Yes. Open Charging → My reservations. Confirmed reservations show a Cancel button. Any held amount is automatically refunded to your wallet."
    },
    {
      q: "What happens if I don't show up?",
      a: "Reservations expire 15 minutes after the start time and are marked as no-show. Repeated no-shows may affect future booking priority. You can mark yourself as no-show manually if you can't make it."
    },
    {
      q: "Can I stop charging early?",
      a: "Yes. On the Charging screen, set the current End SoC and tap Complete session. You'll be charged only for the energy used."
    },
    {
      q: "What does the live route on the map mean?",
      a: "Once you select a station, the map draws a driving route from your location and shows the distance and estimated arrival time. Click 'Open turn-by-turn in Google Maps' to get full navigation."
    },
    {
      q: "What if a charger is broken?",
      a: "On the Find Charger page, expand 'Report an issue with this station' at the bottom of the booking panel. Choose a category, add a description, and submit. The station operator will see it immediately."
    },
    {
      q: "How are prices calculated?",
      a: "Each charger has its own price per kWh (TL). The estimated cost is power (kW) × duration (h) × price. The final amount you pay is based on energy actually consumed."
    },
    {
      q: "Why does the app stop my charging mid-session?",
      a: "If your wallet balance drops below what's needed to continue, the session stops safely to prevent overspend. Top up and start a new session to continue."
    }
  ];

  return (
    <div className="help-grid">
      <div className="hero-panel wide-panel help-intro">
        <span className="eyebrow">Driver guide</span>
        <h2>Getting started with Voltline</h2>
        <p>
          Welcome — this guide walks you through registering your EV, finding a charger, reserving a slot,
          and managing payments. Steps below are in the same order as the sidebar.
        </p>
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">Step by step</h3>
        <div className="help-steps">
          {sections.map((section, index) => (
            <article className="help-step" key={index}>
              <div className="help-step-icon">{section.icon}</div>
              <div>
                <h4>{section.title}</h4>
                <p>{section.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">Frequently asked questions</h3>
        <FaqList items={faqs} />
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">Get in touch</h3>
        <p className="help-contact-lede">
          Stuck at a station, payment issue, or just need a human? Reach out — these are placeholder demo
          channels for the prototype.
        </p>
        <div className="help-contact-grid">
          <article className="help-contact-card">
            <div className="help-contact-icon"><Phone /></div>
            <div>
              <strong>24/7 driver hotline</strong>
              <a href="tel:+908500002828">+90 850 000 28 28</a>
              <small>Live agents, every day. Average pickup under 60 seconds.</small>
            </div>
          </article>
          <article className="help-contact-card">
            <div className="help-contact-icon"><Mail /></div>
            <div>
              <strong>Support email</strong>
              <a href="mailto:support@voltline.demo">support@voltline.demo</a>
              <small>Receipts, refunds, account questions. Reply within 4 hours.</small>
            </div>
          </article>
          <article className="help-contact-card">
            <div className="help-contact-icon"><MessageSquare /></div>
            <div>
              <strong>In-app chat</strong>
              <button
                type="button"
                className="help-contact-link"
                onClick={() => window.dispatchEvent(new CustomEvent("voltline:open-chat"))}
              >
                Open the chat widget
              </button>
              <small>Monday–Sunday, 07:00–23:00. Faster than email for quick fixes.</small>
            </div>
          </article>
          <article className="help-contact-card help-contact-card-urgent">
            <div className="help-contact-icon"><LifeBuoy /></div>
            <div>
              <strong>Roadside assistance</strong>
              <a href="tel:+905550112828">+90 555 011 28 28</a>
              <small>Stranded with a flat charge or stuck plug? Priority dispatch.</small>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function OperatorHelp() {
  const sections: HelpSection[] = [
    {
      icon: <Gauge />,
      title: "Charger status",
      body: (
        <>
          Open <strong>Operations</strong>. The <em>Chargers</em> panel lists every charger at every station
          you manage. Each card shows the station, the charger code, the current price, and a status
          selector. Change <strong>Status</strong> to switch between Available, In use, Reserved, or Out of
          service. Marking a charger Out of service triggers a confirmation, then auto-cancels any active
          reservations on it and notifies affected drivers.
        </>
      )
    },
    {
      icon: <CreditCard />,
      title: "Updating prices",
      body: (
        <>
          On any charger card, edit the <strong>New price</strong> field. A coloured diff badge shows the
          old → new value with the % change. When you tap <strong>Save changes</strong>, a confirmation
          dialog summarises the change before it's applied. New prices take effect on future reservations.
        </>
      )
    },
    {
      icon: <MapPinned />,
      title: "Station configuration",
      body: (
        <>
          In the <em>Station configuration</em> panel, select a station and edit its name, address, opening
          and closing times, or overall status (Available / Maintenance / Closed). Save station to apply.
        </>
      )
    },
    {
      icon: <AlertTriangle />,
      title: "Issue reports",
      body: (
        <>
          Driver-reported issues land in the <em>Issue reports</em> panel. Use the dropdown next to each
          report to move it from <strong>Open</strong> → <strong>In progress</strong> →
          <strong> Resolved</strong>. Drivers are notified when their report is closed.
        </>
      )
    },
    {
      icon: <Clock />,
      title: "Upcoming reservations",
      body: (
        <>
          The <em>Upcoming reservations</em> panel shows the next eight reservations across your stations
          with the vehicle and start time. Use this to anticipate occupancy and prepare maintenance windows.
        </>
      )
    },
    {
      icon: <BatteryCharging />,
      title: "Reports & occupancy",
      body: (
        <>
          The <em>Reports and occupancy</em> panel shows utilisation per station, peak charging hours, open
          issues, and user activity. Tap <strong>Refresh</strong> to refetch metrics on demand.
        </>
      )
    }
  ];

  const faqs: FaqItem[] = [
    {
      q: "What happens when I take a charger Out of service?",
      a: "Any active reservation on that charger is auto-cancelled and the affected driver receives a notification. The charger stops accepting new reservations until you set it back to Available."
    },
    {
      q: "Do price changes affect existing reservations?",
      a: "No. The price stored on a confirmed reservation is locked in at booking time. New prices apply only to reservations created after the change."
    },
    {
      q: "Why didn't a reservation appear here?",
      a: "Upcoming reservations are scoped to stations you operate. If a driver booked a different station, you won't see it. Reservations are also limited to the next 24 hours per system rules."
    },
    {
      q: "How do I escalate an issue I can't resolve?",
      a: "Leave the issue in 'In progress' and contact an administrator. Admins see all issues and can reassign or close them on your behalf."
    }
  ];

  return (
    <div className="help-grid">
      <div className="hero-panel wide-panel help-intro">
        <span className="eyebrow">Operator manual</span>
        <h2>Running your stations</h2>
        <p>
          This guide covers the day-to-day operator workflows: keeping chargers healthy, adjusting pricing,
          resolving driver-reported issues, and reading occupancy reports.
        </p>
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">Operations playbook</h3>
        <div className="help-steps">
          {sections.map((section, index) => (
            <article className="help-step" key={index}>
              <div className="help-step-icon">{section.icon}</div>
              <div>
                <h4>{section.title}</h4>
                <p>{section.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">FAQ</h3>
        <FaqList items={faqs} />
      </div>
    </div>
  );
}

function AdminHelp() {
  const sections: HelpSection[] = [
    {
      icon: <UserCog />,
      title: "Role-based access control (RBAC)",
      body: (
        <>
          Three roles are enforced server-side via the <code>x-demo-role</code> header and verified against
          <code> User.role</code>. <strong>EV_DRIVER</strong> can access vehicles, reservations, sessions,
          wallet, favourites and issue reports. <strong>STATION_OPERATOR</strong> can additionally PATCH
          charger status/price and station fields, plus update issues. <strong>ADMINISTRATOR</strong> gains
          POST/DELETE on <code>/api/admin/stations</code>, PATCH on <code>/api/admin/users/:id</code>, and
          read on admin reports + the audit log.
        </>
      )
    },
    {
      icon: <Database />,
      title: "Data model",
      body: (
        <>
          The Prisma schema (<code>prisma/schema.prisma</code>) contains: <code>User</code>,{" "}
          <code>Vehicle</code>, <code>ChargingStation</code>, <code>Charger</code>, <code>Reservation</code>,{" "}
          <code>ChargingSession</code>, <code>Wallet</code>, <code>Transaction</code>,{" "}
          <code>FavoriteStation</code>, <code>IssueReport</code>, <code>Notification</code>, and{" "}
          <code>AuditLog</code>. Currency is stored in cents (<code>pricePerKwhCents</code>,{" "}
          <code>balanceCents</code>) and converted with <code>toCents/fromCents</code> helpers in{" "}
          <code>server/domain.ts</code>.
        </>
      )
    },
    {
      icon: <ShieldCheck />,
      title: "Audit log integrity",
      body: (
        <>
          Every mutating action emits an <code>AuditLog</code> entry via <code>audit()</code> in{" "}
          <code>server/services/audit.ts</code>. Entries are hash-chained — each row's <code>hash</code> is
          computed from the previous hash, actor, action, target, details, and timestamp. The Activity
          screen calls <code>GET /api/audit</code> and verifies the chain with <code>verifyAuditChain</code>;
          any mismatch surfaces a warning banner.
        </>
      )
    },
    {
      icon: <KeyRound />,
      title: "Security alerts",
      body: (
        <>
          <code>POST /api/security/simulate-failed-login</code> increments the in-memory failed-login
          counter for a given email. When the threshold (5) is hit, a notification is created for every
          active administrator and an audit entry is written. Use the <strong>Trigger failed-login alert</strong>{" "}
          button on the Operations page to test the flow end-to-end.
        </>
      )
    },
    {
      icon: <Wrench />,
      title: "Station & charger administration",
      body: (
        <>
          <strong>POST /api/admin/stations</strong> creates a station with one default charger. Use{" "}
          <strong>POST /api/admin/stations/:id/chargers</strong> to add additional chargers to an existing
          station — codes auto-increment (<code>DC 50kW #02</code>) if left blank. The{" "}
          <code>@@unique([stationId, code])</code> constraint prevents duplicates.{" "}
          <strong>DELETE /api/admin/stations/:id</strong> cascades to chargers, reservations, and sessions,
          so the destructive confirm dialog warns about upcoming bookings.
        </>
      )
    },
    {
      icon: <TerminalSquare />,
      title: "Reports endpoint",
      body: (
        <>
          <code>GET /api/admin/reports</code> returns revenue, station utilisation, peak-hour buckets,
          charger and issue status counts, plus user activity (no-shows, completed/interrupted sessions,
          maintenance issues). Computed in <code>server/services/reports.ts</code> from the live database;
          no caching, refetched on demand from the Operations → Reports panel.
        </>
      )
    },
    {
      icon: <RefreshCw />,
      title: "Bootstrap & state refresh",
      body: (
        <>
          The frontend loads everything it needs from <code>GET /api/bootstrap</code>: current user, all
          users (admin-visible), vehicles, stations + chargers, reservations, sessions, wallet,
          transactions, favourites, issues, notifications, and the latest audit slice. Every mutation in
          the UI re-calls bootstrap on success — keeping client and server in sync without delta logic.
        </>
      )
    },
    {
      icon: <Trash2 />,
      title: "Destructive operation safety",
      body: (
        <>
          Confirm dialogs gate: <strong>station deletion</strong>, <strong>user deactivation</strong>,{" "}
          <strong>role changes</strong>, <strong>setting a charger out of service</strong>, and{" "}
          <strong>price changes</strong>. The confirm callback is invoked only when the user clicks the
          destructive primary; cancel/Esc/overlay-click all dismiss without firing. Implementation:{" "}
          <code>src/components/ConfirmDialog.tsx</code> + <code>confirmState</code> in App.tsx.
        </>
      )
    }
  ];

  const faqs: FaqItem[] = [
    {
      q: "How do I add a new operator account?",
      a: "Go to Operations → User and operator management. Find or create a user, set their role to Operator. Role changes are gated by a confirm dialog and audited. The operator can sign in immediately after."
    },
    {
      q: "Where do I see the system availability target?",
      a: "Operations → Reports and occupancy. The availability KPI is computed from session interruption ratios and is rendered as the trailing 99.5% line in the metric strip per ADR-08."
    },
    {
      q: "How do I export the audit log?",
      a: "The Activity screen renders the full audit chain. Use your browser's print-to-PDF on this screen, or query GET /api/audit directly for a JSON dump including the hash chain and verification status."
    },
    {
      q: "Can I roll back a price change?",
      a: "Not from the UI. The audit log records both the actor and the change details, so use that to identify the previous price and re-apply it via the same Save flow."
    },
    {
      q: "What happens to data when I delete a station?",
      a: "ChargingStation → Charger has onDelete: Cascade, which removes chargers and their reservations/sessions. Wallet transactions are preserved (Transaction.chargerId becomes nullable). The audit log entry retains the station's name and ID for traceability."
    },
    {
      q: "How are reservations prevented from overlapping?",
      a: "validateReservationRules() in server/domain.ts checks overlap against existing PENDING/CONFIRMED reservations on the same charger, enforces a 2h max duration, a 24h booking window, station operating hours, vehicle-charger connector match, and wallet balance vs. estimated cost."
    }
  ];

  return (
    <div className="help-grid">
      <div className="hero-panel wide-panel help-intro">
        <span className="eyebrow">Administrator manual</span>
        <h2>System architecture & operations</h2>
        <p>
          Technical reference for administrators. Covers RBAC, the data model, audit-log integrity, the
          report endpoint, destructive-operation safety, and bootstrap state flow. Endpoints reference
          paths under <code>server/routes/</code>.
        </p>
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">Architecture & administration</h3>
        <div className="help-steps">
          {sections.map((section, index) => (
            <article className="help-step" key={index}>
              <div className="help-step-icon">{section.icon}</div>
              <div>
                <h4>{section.title}</h4>
                <p>{section.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">Operations FAQ</h3>
        <FaqList items={faqs} />
      </div>

      <div className="hero-panel wide-panel">
        <h3 className="help-panel-title">Reference</h3>
        <div className="reference-grid">
          <div className="reference-card">
            <FileText />
            <strong>Requirements</strong>
            <span>
              All 63 traceability rows are declared in <code>src/shared/requirements.ts</code> and surfaced
              in the Activity → Coverage view.
            </span>
          </div>
          <div className="reference-card">
            <Star />
            <strong>Group28 doc</strong>
            <span>
              <code>Group28.pdf</code> at the repo root is the source of truth for the requirements doc.
              Any new feature must map to a requirement ID (EDR / SOR / ADR / MNS / PWS / UIR / GRR / SDR).
            </span>
          </div>
          <div className="reference-card">
            <Database />
            <strong>Seed data</strong>
            <span>
              <code>server/seedData.ts</code> + <code>prisma/seed.ts</code> reset the database to a known
              state. Run <code>npm run db:seed</code> to reseed for demos.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqList({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <ul className="faq-list">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <li key={index} className={`faq-item ${open ? "open" : ""}`}>
            <button
              type="button"
              className="faq-question"
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
            >
              <span>{item.q}</span>
              <ChevronDown />
            </button>
            {open && <div className="faq-answer">{item.a}</div>}
          </li>
        );
      })}
    </ul>
  );
}
