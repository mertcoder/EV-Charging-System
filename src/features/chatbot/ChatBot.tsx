import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import type { UserRole } from "../../shared/domain";
import type { ViewId } from "../../appTypes";

interface Intent {
  keywords: RegExp;
  viewId: ViewId;
  reply: string;
  ctaLabel: string;
  roles?: UserRole[];
}

const INTENTS: Intent[] = [
  {
    keywords: /(charg(?:e|ing).*(?:session|now|live|active)|live session|kwh|state of charge|soc|active session|stop charging|complete session)/i,
    viewId: "charge",
    reply: "Your live session, running cost, and sync state live on the Charging page.",
    ctaLabel: "Open Charging",
    roles: ["EV_DRIVER"]
  },
  {
    keywords: /(reserve|reservation|booking|\bbook\b|slot|find.*(?:charger|station)|station nearby|map)/i,
    viewId: "reserve",
    reply: "Search nearby stations, pick a slot, and reserve from Find a Charger.",
    ctaLabel: "Open Find Charger",
    roles: ["EV_DRIVER"]
  },
  {
    keywords: /(\bvehicle\b|my ev|\bcar\b|plate|tesla|renault|connector type|register.*(?:vehicle|car))/i,
    viewId: "vehicle",
    reply: "Add or update your EV under My EV.",
    ctaLabel: "Open My EV",
    roles: ["EV_DRIVER"]
  },
  {
    keywords: /(wallet|balance|top.?up|refund|payment|\bmoney\b|receipt|transaction|cost|invoice)/i,
    viewId: "wallet",
    reply: "Top-ups, refunds, and the receipt history live in the Wallet.",
    ctaLabel: "Open Wallet",
    roles: ["EV_DRIVER"]
  },
  {
    keywords: /(contact|hotline|\bphone\b|\bemail\b|reach|talk to|\bcall\b|roadside|stranded|stuck)/i,
    viewId: "help",
    reply: "All contact channels — hotline, email, chat, roadside — are at the bottom of Guide & Help.",
    ctaLabel: "Open Guide & Help",
    roles: ["EV_DRIVER"]
  },
  {
    keywords: /(\bops\b|operation|charger status|station status|\bprice\b|maintenance|out of service|issue report|operator)/i,
    viewId: "ops",
    reply: "Charger status, pricing, station config, and issue reports are in Operations.",
    ctaLabel: "Open Operations",
    roles: ["STATION_OPERATOR", "ADMINISTRATOR"]
  },
  {
    keywords: /(audit|\blog\b|evidence|activity|security|retention|compliance|hash chain)/i,
    viewId: "evidence",
    reply: "Audit logs and system evidence are in the Activity tab.",
    ctaLabel: "Open Activity",
    roles: ["ADMINISTRATOR"]
  },
  {
    keywords: /(\buser(?:s)?\b|account|admin user|\brole\b|deactivate|activate)/i,
    viewId: "ops",
    reply: "User accounts and roles are managed in the Operations admin panel.",
    ctaLabel: "Open Operations",
    roles: ["ADMINISTRATOR"]
  },
  {
    keywords: /(help|guide|how|tutorial|faq|question|getting started|step.?by.?step)/i,
    viewId: "help",
    reply: "The step-by-step walkthrough and FAQ are on the Guide page.",
    ctaLabel: "Open Guide"
  }
];

interface ChatMessage {
  id: number;
  from: "user" | "bot";
  text: string;
  action?: { label: string; viewId: ViewId };
}

function suggestionsFor(role: UserRole): string[] {
  if (role === "EV_DRIVER") return ["How do I reserve a charger?", "Where is my wallet?", "How do I contact support?"];
  if (role === "STATION_OPERATOR") return ["Take a charger out of service", "Where are issue reports?", "Where do I update price?"];
  return ["Open audit log", "Manage user accounts", "Operator reports"];
}

function findIntent(text: string, role: UserRole) {
  const normalized = text.toLowerCase();
  return INTENTS.find((intent) => {
    if (intent.roles && !intent.roles.includes(role)) return false;
    return intent.keywords.test(normalized);
  });
}

function fallbackReply(role: UserRole): string {
  const examples = suggestionsFor(role).map((item) => `"${item}"`).join(", ");
  return `I didn't catch that. Try one of: ${examples}.`;
}

let messageIdCounter = 0;
function nextId() {
  messageIdCounter += 1;
  return messageIdCounter;
}

export function ChatBot({ role, onNavigate }: { role: UserRole; onNavigate: (view: ViewId) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      from: "bot",
      text: "Hi! Tell me what you need — charging, wallet, support — and I'll take you to the right page."
    }
  ]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("voltline:open-chat", handleOpen);
    return () => window.removeEventListener("voltline:open-chat", handleOpen);
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  function reply(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const intent = findIntent(trimmed, role);
    setMessages((current) => [
      ...current,
      { id: nextId(), from: "user", text: trimmed },
      intent
        ? { id: nextId(), from: "bot", text: intent.reply, action: { label: intent.ctaLabel, viewId: intent.viewId } }
        : { id: nextId(), from: "bot", text: fallbackReply(role) }
    ]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    reply(input);
    setInput("");
  }

  function handleAction(view: ViewId) {
    onNavigate(view);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`chatbot-launcher${open ? " open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="chatbot-panel"
        aria-label={open ? "Close assistant" : "Open assistant"}
        title={open ? "Close assistant" : "Need help?"}
      >
        {open ? <X /> : <MessageCircle />}
      </button>
      {open && (
        <section id="chatbot-panel" className="chatbot-panel" role="dialog" aria-label="Voltline assistant">
          <header className="chatbot-header">
            <div className="chatbot-header-id">
              <span className="chatbot-avatar"><Bot /></span>
              <div>
                <strong>Voltline assistant</strong>
                <small>Routes you to the right page</small>
              </div>
            </div>
            <button type="button" className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close">
              <X />
            </button>
          </header>
          <div className="chatbot-messages" ref={listRef}>
            {messages.map((message) => (
              <div key={message.id} className={`chatbot-message chatbot-message-${message.from}`}>
                <div className="chatbot-bubble">{message.text}</div>
                {message.action && (
                  <button
                    type="button"
                    className="chatbot-cta"
                    onClick={() => handleAction(message.action!.viewId)}
                  >
                    {message.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="chatbot-suggestions">
            {suggestionsFor(role).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chatbot-suggestion"
                onClick={() => reply(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form className="chatbot-input" onSubmit={submit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask something..."
              aria-label="Message"
            />
            <button type="submit" className="chatbot-send" aria-label="Send" disabled={!input.trim()}>
              <Send />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
