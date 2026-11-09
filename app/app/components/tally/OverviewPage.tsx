import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction, useActionQuery } from "@agent-native/core/client/hooks";
import { IconArrowRight, IconFileUpload, IconFlask } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type Overview, relativeTime } from "@/lib/tally";
import { cn } from "@/lib/utils";
import { pathForLocation } from "@shared/routes";

import { CountUpMoney, Money, NotchMark, SampleBadge } from "./primitives";
import { UploadPanel } from "./UploadPanel";

type VendorCard = Overview["vendors"][number];

export function OverviewPage() {
  const { data, isLoading } = useActionQuery<Overview>("get-overview", {});
  const [uploading, setUploading] = useState(false);

  if (isLoading || !data) return <div className="p-8 text-sm text-muted-foreground">Opening the ledger…</div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 md:px-8">
      <Hero overview={data} />
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
  const { totals, nextDeadline } = overview;
  return (
    <section className="grid gap-6 border-b border-rule pb-8 md:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recoverable</p>
        <CountUpMoney cents={totals.recoverableCents} className="block text-6xl font-medium leading-none text-notch md:text-7xl" />
        <p className="mt-3 text-sm text-muted-foreground">
          {totals.findingCount} overcharge{totals.findingCount === 1 ? "" : "s"} standing
          {totals.acceptedCount > 0 && ` · ${totals.acceptedCount} accepted`}
          {totals.rejectedCount > 0 && ` · ${totals.rejectedCount} rejected`}
          {totals.explainedCount > 0 && ` · ${totals.explainedCount} explained by your rules`}
        </p>
      </div>
      <div className="md:border-l md:border-rule md:pl-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">At risk</p>
        <CountUpMoney cents={totals.atRiskCents} className="block text-4xl font-medium leading-none text-amber md:text-5xl" />
        {nextDeadline ? (
          <Link
            to={pathForLocation({ view: "finding", vendorId: nextDeadline.vendorId, findingId: nextDeadline.findingId })}
            className="mt-3 inline-flex items-center gap-1 text-sm text-foreground underline decoration-amber/60 underline-offset-4 hover:decoration-amber"
          >
            Notice due {nextDeadline.deadlineLabel} · {nextDeadline.vendorName}
            <IconArrowRight className="size-3.5" />
          </Link>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No renewal deadlines in the next 45 days.</p>
        )}
      </div>
    </section>
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
  const reset = async () => {
    if (!window.confirm("Delete all vendors, documents and findings?")) return;
    try {
      await callAction("reset-demo", {});
      await queryClient.invalidateQueries();
      toast.success("Cleared. The ledger is empty.");
    } catch (error) {
      toast.error(actionErrorMessage(error));
    }
  };
  return (
    <div className="border-t border-rule pt-4 text-right">
      <button type="button" onClick={reset} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Reset all data
      </button>
    </div>
  );
}
