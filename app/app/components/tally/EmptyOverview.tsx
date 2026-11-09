import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction } from "@agent-native/core/client/hooks";
import {
  IconArrowRight,
  IconCalculator,
  IconFileText,
  IconFileUpload,
  IconFlask,
  IconLoader2,
  IconMailForward,
  type Icon,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { TallyfoilMark } from "./TallyfoilMark";

const STEPS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: IconFileText,
    title: "Add both halves",
    body: "The contract or order form, and the invoices or usage export. PDF, CSV or pasted text.",
  },
  {
    icon: IconCalculator,
    title: "The agent reads, code counts",
    body: "Every term and bill line it records is quoted from the page. The engine does all the math.",
  },
  {
    icon: IconMailForward,
    title: "Dispute with proof",
    body: "Review each finding, approve the drafted email, send it yourself. Nothing goes out without you.",
  },
];

/**
 * First run: who we are, how it works, and the two ways to start. The sample
 * is the recommended path because it shows the whole loop in about a minute.
 */
export function EmptyOverview({ onUpload }: { onUpload: () => void }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const loadSample = async () => {
    setLoading(true);
    try {
      await callAction("load-sample-data", {});
      await queryClient.invalidateQueries();
      toast.success("Sample loaded. The agent is auditing it now.", {
        description: "Watch the chat on the right. Findings land here as they're proven.",
      });
      sendToAgentChat({
        message: "Audit both sample vendors",
        context: "The user just loaded the labeled sample set (Cobalt Workspace and Halcyon AI). Use the audit-vendor skill for each.",
        submit: true,
      });
    } catch (error) {
      toast.error("Couldn't load the sample", { description: actionErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="welcome-title" className="overflow-hidden rounded-2xl border border-rule bg-card shadow-[0_30px_80px_-50px_rgba(0,0,0,0.6)]">
      <div className="night-panel relative grid items-center gap-8 px-6 py-8 md:grid-cols-[1.05fr_1fr] md:px-10 md:py-10">
        <div>
          <div className="flex items-center gap-2.5">
            <TallyfoilMark className="size-8 ring-1 ring-white/15 rounded-[9px]" />
            <span className="font-figure text-[11px] uppercase tracking-[0.22em] text-white/50">Vendor bill auditor</span>
          </div>
          <h2 id="welcome-title" className="mt-5 font-ledger text-5xl font-medium leading-none tracking-tight md:text-6xl">
            <span className="silver-text">Tallyfoil</span>
          </h2>
          <p className="mt-4 font-ledger text-xl leading-snug text-white/85 md:text-2xl">
            Your vendor keeps one half of the deal. You keep the other.{" "}
            <em className="text-[#ff6a42]">We check they match.</em>
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
            Named after the medieval tally stick: one stick, notched and split in two, a half for each side. If the notches didn&rsquo;t line up,
            someone was overcharging. Tallyfoil does that for your vendor bills, and quotes both documents for every overcharge it finds.
          </p>
        </div>
        <TallyStick />
      </div>

      <ol className="grid divide-y divide-rule border-b border-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {STEPS.map(({ icon: StepIcon, title, body }, i) => (
          <li key={title} className="flex gap-3 px-6 py-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-rule bg-shade text-foreground">
              <StepIcon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                <span className="figure mr-1.5 text-notch">{i + 1}</span>
                {title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 p-4 md:grid-cols-2 md:p-6">
        <ChoiceCard
          primary
          icon={loading ? <IconLoader2 className="size-5 animate-spin" /> : <IconFlask className="size-5" />}
          tag="Recommended · about 90 seconds"
          title="Watch a sample audit"
          body="Two made-up vendors, 17 documents. The agent audits them live while you watch. Marked as sample data everywhere it appears."
          cta={loading ? "Loading the sample…" : "Load sample audit"}
          disabled={loading}
          onClick={() => void loadSample()}
        />
        <ChoiceCard
          icon={<IconFileUpload className="size-5" />}
          tag="Your documents"
          title="Audit your own bills"
          body="Add a contract and the bills it covers. Files are read in your browser; only their text is sent to the audit."
          cta="Upload documents"
          onClick={onUpload}
        />
      </div>
    </section>
  );
}

function ChoiceCard({
  primary = false,
  icon,
  tag,
  title,
  body,
  cta,
  disabled,
  onClick,
}: {
  primary?: boolean;
  icon: ReactNode;
  tag: string;
  title: string;
  body: string;
  cta: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex h-full flex-col items-start gap-3 rounded-xl border p-5 text-left transition duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notch focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        "disabled:pointer-events-none disabled:opacity-80 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        primary ? "border-notch/40 bg-notch/[0.06] hover:border-notch/70" : "border-rule bg-background hover:border-foreground/25",
      )}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-lg",
            primary ? "bg-notch text-white" : "border border-rule bg-card text-foreground",
          )}
        >
          {icon}
        </span>
        <span className={cn("font-figure text-[10px] uppercase tracking-[0.14em]", primary ? "text-notch" : "text-muted-foreground")}>{tag}</span>
      </div>
      <div>
        <p className="font-ledger text-xl font-medium">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <span className={cn("mt-auto inline-flex items-center gap-1.5 text-sm font-semibold", primary ? "text-notch" : "text-foreground")}>
        {cta}
        <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      </span>
    </button>
  );
}

/** Notch positions along the stick: one per month. */
const NOTCHES = Array.from({ length: 12 }, (_, i) => 40 + i * 29);
const FLAGGED = 8;

/**
 * A split tally stick. Their half (the bill) on top, your half (the contract)
 * below. The halves slide together, a scan runs along the seam, and the one
 * notch that doesn't match glows red: that month was billed twice.
 */
function TallyStick() {
  const flagX = NOTCHES[FLAGGED] ?? 0;
  return (
    <svg
      viewBox="0 0 400 220"
      className="w-full max-w-[460px] justify-self-center overflow-visible"
      role="img"
      aria-label="A tally stick split in two: the bill on top, the contract below. Every notch lines up except one month that was billed twice."
    >
      <defs>
        <linearGradient id="tally-their" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6efe4" />
          <stop offset="1" stopColor="#c9c1b3" />
        </linearGradient>
        <linearGradient id="tally-your" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3fbfab" />
          <stop offset="1" stopColor="#24806f" />
        </linearGradient>
        <linearGradient id="tally-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="tally-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <text x="16" y="44" className="font-figure" fontSize="9" letterSpacing="2" fill="rgba(246,239,228,0.5)">
        THEIR HALF · THE BILL
      </text>
      <text x="16" y="194" className="font-figure" fontSize="9" letterSpacing="2" fill="rgba(69,212,191,0.8)">
        YOUR HALF · THE CONTRACT
      </text>

      <g className="tally-top">
        <rect x="12" y="56" width="376" height="48" rx="12" fill="url(#tally-their)" />
        {[66, 76, 86].map((y) => (
          <line key={y} x1="24" x2="376" y1={y} y2={y} stroke="#8a8274" strokeOpacity="0.18" />
        ))}
        {NOTCHES.map((x, i) =>
          i === FLAGGED ? (
            <g key={x} className="tally-flag" filter="url(#tally-glow)">
              <path d={`M${x - 11},104 L${x - 6},84 L${x - 1},104 Z`} fill="#ff5a36" />
              <path d={`M${x + 1},104 L${x + 6},84 L${x + 11},104 Z`} fill="#ff5a36" />
            </g>
          ) : (
            <path key={x} d={`M${x - 5},104 L${x},86 L${x + 5},104 Z`} fill="#0b0b0d" />
          ),
        )}
      </g>

      <g className="tally-bottom">
        <rect x="12" y="112" width="376" height="48" rx="12" fill="url(#tally-your)" />
        {[126, 136, 146].map((y) => (
          <line key={y} x1="24" x2="376" y1={y} y2={y} stroke="#0b3d35" strokeOpacity="0.25" />
        ))}
        {NOTCHES.map((x) => (
          <path key={x} d={`M${x - 5},112 L${x},130 L${x + 5},112 Z`} fill="#0b0b0d" />
        ))}
      </g>

      <rect className="tally-scan" x="-40" y="50" width="40" height="116" fill="url(#tally-beam)" style={{ mixBlendMode: "screen" }} />

      <g className="tally-label">
        <line x1={flagX} x2={flagX} y1="22" y2="52" stroke="#ff6a42" strokeWidth="1.2" strokeDasharray="2 2" />
        <rect x={flagX - 44} y="4" width="88" height="20" rx="10" fill="#ff5a36" />
        <text x={flagX} y="18" textAnchor="middle" className="font-figure" fontSize="10" fontWeight="600" fill="#0b0b0d">
          billed twice
        </text>
      </g>
    </svg>
  );
}
