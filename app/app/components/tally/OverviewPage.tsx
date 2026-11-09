import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction, useActionQuery } from "@agent-native/core/client/hooks";
import { IconArrowRight, IconFileUpload, IconFlask } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type Overview, relativeTime } from "@/lib/tally";
import { cn } from "@/lib/utils";
import { pathForLocation } from "@shared/routes";

import { MirrorChart } from "./MirrorChart";
import { CountUpMoney, Money, NotchMark, SampleBadge } from "./primitives";
import { UploadPanel } from "./UploadPanel";

type VendorCard = Overview["vendors"][number];

export function OverviewPage() {
  const { data, isLoading } = useActionQuery<Overview>("get-overview", {});
  const [uploading, setUploading] = useState(false);

  if (isLoading || !data) return <div className="p-8 text-sm text-muted-foreground">Opening the ledger…</div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 md:px-8">
      {data.vendors.length > 0 && <Hero overview={data} />}
      {data.vendors.length === 0 ? (
        <EmptyState onUpload={() => setUploading(true)} />
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Vendors</h2>
            <Button variant="ghost" size="sm" onClick={() => setUploading(true)}>
              <IconFileUpload className="size-4" /> Add bills
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.vendors.map((vendor) => (
              <VendorCardView key={vendor.id} vendor={vendor} />
            ))}
          </div>
        </section>
      )}
      {uploading && <UploadPanel vendors={data.vendors} onClose={() => setUploading(false)} />}
      {data.vendors.length > 0 && <ResetLink />}
    </div>
  );
}

function Hero({ overview }: { overview: Overview }) {
  const navigate = useNavigate();
  const { totals, nextDeadline } = overview;
  const overcharges = totals.findingCount - totals.deadlineCount;

  return (
    <section className="night-panel overflow-hidden rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]" aria-label="What your vendors owe you">
      <div className="grid gap-8 px-6 pt-8 md:grid-cols-[1.3fr_1fr] md:px-10 md:pt-10">
        <div>
          <p className="font-figure text-[11px] uppercase tracking-[0.2em] text-white/45">Recoverable · proven line by line</p>
          <CountUpMoney cents={totals.recoverableCents} className="silver-text ledger-numeral mt-2 block text-6xl font-medium leading-[0.95] md:text-8xl" />
          <p className="mt-4 text-sm text-white/55">
            {overcharges} overcharge{overcharges === 1 ? "" : "s"} across {overview.vendors.length} vendor{overview.vendors.length === 1 ? "" : "s"}
            {totals.acceptedCount > 0 && ` · ${totals.acceptedCount} accepted`}
            {totals.explainedCount > 0 && ` · ${totals.explainedCount} explained by your rules`}
          </p>
        </div>
        {nextDeadline ? (
          <Link
            to={pathForLocation({ view: "finding", vendorId: nextDeadline.vendorId, findingId: nextDeadline.findingId })}
            className="group self-end rounded-xl border border-[#e0a43a]/30 bg-[#e0a43a]/[0.06] p-5 transition-colors hover:border-[#e0a43a]/60"
          >
            <p className="font-figure text-[11px] uppercase tracking-[0.2em] text-[#e0a43a]/80">At risk · auto-renewal</p>
            <CountUpMoney cents={totals.atRiskCents} className="ledger-numeral mt-1 block text-4xl text-[#f0b54a] md:text-5xl" />
            <Countdown deadline={nextDeadline.deadline} />
            <p className="mt-2 flex items-center gap-1 text-xs text-white/50 group-hover:text-white/80">
              Tell {nextDeadline.vendorName} by {nextDeadline.deadlineLabel} <IconArrowRight className="size-3" />
            </p>
          </Link>
        ) : (
          <p className="self-end text-sm text-white/45">No renewal deadlines in the next 45 days.</p>
        )}
      </div>

      <MirrorChart
        months={overview.timeline}
        height={300}
        className="mt-6"
        onSelect={(month) =>
          month.topFinding && navigate(pathForLocation({ view: "finding", vendorId: month.topFinding.vendorId, findingId: month.topFinding.id }))
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-3 font-figure text-[11px] uppercase tracking-[0.14em] text-white/45 md:px-10">
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-px w-5 bg-[#f6efe4]" /> Their half · billed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-5 bg-[#45d4bf]" /> Your half · agreed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 bg-[#ff4d2e]/80" /> The gap
          </span>
        </span>
        <span>Hover a month · click a red one for the proof</span>
      </div>
    </section>
  );
}

/** Days, hours, minutes, seconds until the notice window closes (end of that day). */
function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const end = new Date(`${deadline}T23:59:59`).getTime();
  const left = now === null ? null : Math.max(0, end - now);
  const parts =
    left === null
      ? ["--", "--", "--", "--"]
      : [Math.floor(left / 86_400_000), Math.floor(left / 3_600_000) % 24, Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60].map((v) =>
          String(v).padStart(2, "0"),
        );

  return (
    <div className="mt-3 flex gap-1.5 font-figure" aria-label={left === null ? "Time left to give notice" : `${parts[0]} days left to give notice`}>
      {parts.map((value, i) => (
        <span key={i} className="flex min-w-12 flex-col items-center rounded-md bg-black/40 px-2 py-1.5">
          <span className="text-lg tabular-nums text-white">{value}</span>
          <span className="text-[9px] uppercase tracking-wider text-white/40">{["days", "hrs", "min", "sec"][i]}</span>
        </span>
      ))}
    </div>
  );
}

function VendorCardView({ vendor }: { vendor: VendorCard }) {
  const unread = vendor.unreadDocumentCount;
  return (
    <Link
      to={pathForLocation({ view: "vendor", vendorId: vendor.id })}
      className="group block rounded-md border border-rule bg-card p-4 transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ledger-numeral truncate text-xl font-medium">{vendor.name}</h3>
            {vendor.isSample && <SampleBadge />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {vendor.kind === "seat_subscription" ? "Seats" : "Usage"} · {vendor.documentCount} documents · audited {relativeTime(vendor.lastAuditedAt)}
          </p>
        </div>
        <div className="text-right">
          <Money cents={vendor.totals.recoverableCents} className={cn("text-lg", vendor.totals.recoverableCents > 0 ? "text-notch" : "text-muted-foreground")} />
          <p className="text-xs text-muted-foreground">{vendor.totals.openCount} open</p>
        </div>
      </div>
      {unread > 0 && (
        <p className="mt-3 text-xs text-amber">
          {unread} document{unread === 1 ? "" : "s"} not read yet
        </p>
      )}
      {vendor.nextDeadline && (
        <p className="mt-3 text-xs text-amber">
          Renewal notice due {vendor.nextDeadline.deadlineLabel} · {vendor.nextDeadline.atRisk} at risk
        </p>
      )}
    </Link>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const loadSample = async () => {
    setLoading(true);
    try {
      await callAction("load-sample-data", {});
      await queryClient.invalidateQueries();
      sendToAgentChat({
        message: "Audit both sample vendors",
        context: "The user just loaded the labeled sample set (Cobalt Workspace and Halcyon AI). Use the audit-vendor skill for each.",
        submit: true,
      });
    } catch (error) {
      toast.error(actionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ledger-ruled rounded-md border border-rule bg-card px-6 py-12 text-center">
      <NotchMark className="mx-auto size-10" />
      <h2 className="ledger-numeral mx-auto mt-4 max-w-xl text-3xl font-medium">Your vendors bill you. Tallyfoil checks the bill.</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
        The agent reads your contracts and invoices and quotes every figure it records. Code does the arithmetic. Every overcharge comes with
        both halves of the proof.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={loadSample} disabled={loading} className="bg-notch text-white hover:bg-notch/90">
          <IconFlask className="size-4" /> {loading ? "Loading…" : "Load sample audit"}
        </Button>
        <Button variant="outline" onClick={onUpload}>
          <IconFileUpload className="size-4" /> Upload your bills
        </Button>
      </div>
    </section>
  );
}

function ResetLink() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const reset = async () => {
    try {
      await callAction("reset-demo", {});
      await queryClient.invalidateQueries();
      toast.success("Cleared. The ledger is empty.");
    } catch (error) {
      toast.error(actionErrorMessage(error));
    } finally {
      setConfirming(false);
    }
  };
  return (
    <div className="flex items-center justify-end gap-3 border-t border-rule pt-4 text-xs text-muted-foreground">
      {confirming ? (
        <>
          <span>Delete every vendor, document and finding?</span>
          <button type="button" onClick={() => void reset()} className="font-medium text-notch hover:underline">
            Delete all
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="hover:text-foreground">
            Keep
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="underline-offset-4 hover:text-foreground hover:underline">
          Reset all data
        </button>
      )}
    </div>
  );
}
