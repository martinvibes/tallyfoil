import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { setClientAppState } from "@agent-native/core/client/application-state";
import { actionErrorMessage, callAction, useActionQuery } from "@agent-native/core/client/hooks";
import { IconArrowLeft, IconFileUpload, IconMail, IconRefresh } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type VendorDetail, relativeTime } from "@/lib/tally";
import { OVERVIEW_PATH, pathForLocation } from "@shared/routes";

import { FindingsList } from "./FindingsList";
import { CountUpMoney, LedgerHeading, SampleBadge } from "./primitives";
import { TallyStick } from "./TallyStick";
import { UploadPanel } from "./UploadPanel";
import { YourHalf } from "./YourHalf";

type Finding = VendorDetail["findings"][number];

/** Three columns: your half (left), the findings (center), the evidence (right, the child route). */
export function VendorWorkspace() {
  const { vendorId = "", findingId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useActionQuery<VendorDetail>("get-vendor", { vendorId }, { enabled: Boolean(vendorId) });
  const [uploading, setUploading] = useState(false);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Opening the ledger…</div>;
  if (error || !data) {
    return (
      <div className="space-y-3 p-8 text-sm">
        <p className="text-muted-foreground">This vendor isn&rsquo;t on your ledger.</p>
        <Link to={OVERVIEW_PATH} className="underline underline-offset-4">
          Back to the overview
        </Link>
      </div>
    );
  }

  const openFinding = (finding: Pick<Finding, "id" | "title">) => {
    navigate(pathForLocation({ view: "finding", vendorId, findingId: finding.id }));
    void setClientAppState("selection", { kind: "finding", vendorId, findingId: finding.id, label: finding.title });
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 md:px-6">
      <WorkspaceHeader detail={data} onUpload={() => setUploading(true)} />
      {uploading && <UploadPanel vendors={[data.vendor]} defaultVendorId={vendorId} onClose={() => setUploading(false)} />}
      <TallyStick
        notches={data.timeline}
        onSelect={(notch) => {
          const first = data.findings.find((finding) => finding.id === notch.findingIds[0]);
          if (first) openFinding(first);
        }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,1.15fr)]">
        <aside className="order-3 lg:col-span-2 2xl:order-1 2xl:col-span-1" aria-label="Your half">
          <YourHalf detail={data} />
        </aside>
        <section className="order-1 space-y-3 2xl:order-2" aria-label="Findings">
          <FindingsList detail={data} selectedId={findingId} onSelect={openFinding} />
        </section>
        <section className="order-2 min-w-0 2xl:order-3" aria-label="Evidence">
          <div className="lg:sticky lg:top-4">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}

function WorkspaceHeader({ detail, onUpload }: { detail: VendorDetail; onUpload: () => void }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const { vendor, totals } = detail;
  const unread = detail.documents.filter((document) => document.status === "new").length;
  const latestDispute = detail.disputes[0];

  const rerun = async () => {
    setRunning(true);
    try {
      const result = await callAction<{ message: string }>("run-audit", { vendorId: vendor.id });
      await queryClient.invalidateQueries();
      toast.success(result.message);
    } catch (error) {
      toast.error(actionErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const draftDispute = () =>
    sendToAgentChat({
      message: `Draft the dispute for ${vendor.name}`,
      context: `Vendor ${vendor.id}. Use the write-dispute skill; amounts come from draft-dispute only.`,
      submit: true,
    });

  return (
    <header className="space-y-4 border-b border-rule pb-5">
      <Link to={OVERVIEW_PATH} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <IconArrowLeft className="size-3.5" /> All vendors
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="ledger-numeral text-3xl font-medium md:text-4xl">{vendor.name}</h1>
            {vendor.isSample && <SampleBadge />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {vendor.kind === "seat_subscription" ? "Per-seat subscription" : "Usage-metered"} · {detail.invoices.length} bills · audited{" "}
            {relativeTime(detail.lastAuditedAt)}
            {unread > 0 && <span className="ml-2 rounded-full bg-amber/15 px-2 py-0.5 text-amber">{unread} waiting to be read</span>}
          </p>
        </div>
        <div className="flex items-end gap-6">
          <div>
            <LedgerHeading>Recoverable</LedgerHeading>
            <CountUpMoney cents={totals.recoverableCents} className="block text-3xl leading-tight text-notch" />
          </div>
          {totals.atRiskCents > 0 && (
            <div>
              <LedgerHeading>At risk</LedgerHeading>
              <CountUpMoney cents={totals.atRiskCents} className="block text-2xl leading-tight text-amber" />
              {detail.nextDeadline && <p className="text-xs text-muted-foreground">notice by {detail.nextDeadline.deadlineLabel}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={draftDispute} disabled={totals.recoverableCents === 0} className="bg-notch text-white hover:bg-notch/90">
          <IconMail className="size-4" /> Draft dispute
        </Button>
        {latestDispute && (
          <Button variant="outline" asChild>
            <Link to={pathForLocation({ view: "dispute", disputeId: latestDispute.id })}>
              Open {latestDispute.status} dispute · {latestDispute.amount}
            </Link>
          </Button>
        )}
        <Button variant="ghost" onClick={rerun} disabled={running}>
          <IconRefresh className="size-4" /> {running ? "Auditing…" : "Re-run audit"}
        </Button>
        <Button variant="ghost" onClick={onUpload}>
          <IconFileUpload className="size-4" /> Add documents
        </Button>
      </div>
    </header>
  );
}

/** Shown in the evidence column before a finding is picked. */
export function EvidencePlaceholder() {
  return (
    <div className="ledger-ruled rounded-md border border-dashed border-rule p-6 text-sm text-muted-foreground">
      <p className="ledger-numeral text-lg text-foreground">Pick a finding.</p>
      <p className="mt-1">You&rsquo;ll see their half (the bill) and your half (what was agreed), with the quotes marked and the arithmetic in between.</p>
    </div>
  );
}
