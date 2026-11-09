import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction } from "@agent-native/core/client/hooks";
import { IconCheck, IconChevronRight, IconX } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { VendorDetail } from "@/lib/tally";
import { cn } from "@/lib/utils";

import { LedgerHeading, Money, SeverityLabel, StatusChip } from "./primitives";

type Group = VendorDetail["findingGroups"][number];
type Finding = VendorDetail["findings"][number];
type Review = (findings: Finding[], decision: "accept" | "reject", reason?: string, approval?: string) => Promise<void>;
/** Findings whose "why is this OK?" box is open; at most one box at a time. */
type Rejecting = Finding[] | null;

const SEVERITY_TITLES: Record<string, string> = { breach: "Breach", verify: "Verify", deadline: "Deadline" };
const REVIEWABLE = new Set(["open", "accepted", "rejected"]);

/** Accept or reject findings, then let the agent turn a rejection into a rule. */
const useReview = (vendor: { id: string; name: string }) => {
  const queryClient = useQueryClient();
  return async (findings: Finding[], decision: "accept" | "reject", reason?: string, approval?: string) => {
    const ids = findings.filter((finding) => REVIEWABLE.has(finding.status)).map((finding) => finding.id);
    if (ids.length === 0) return;
    try {
      await callAction("review-finding", { findingIds: ids, decision, ...(reason ? { reason } : {}) });
      await queryClient.invalidateQueries();
      if (decision === "accept") {
        toast.success(ids.length === 1 ? "Accepted. It will go in the dispute." : `Accepted ${ids.length} findings.`);
        return;
      }
      const subject = findings.length === 1 ? `"${findings[0]?.title}"` : `${findings.length} "${findings[0]?.checkLabel}" findings`;
      let message = `I rejected ${subject} for ${vendor.name}: "${reason}". Learn from it.`;
      let context = `Rejected finding ids: ${ids.join(", ")}. Use the learn-from-rejection skill.`;
      if (approval?.trim()) {
        const doc = await callAction<{ id: string }>("add-document", {
          vendorId: vendor.id,
          kind: "note",
          name: `approval-${new Date().toISOString().slice(0, 10)}.txt`,
          text: approval.trim(),
        });
        message = `${message} The approval email is attached.`;
        context = `${context} The user pasted the approval email as document ${doc.id}. Prove the rule with its approval line (proof.documentId = ${doc.id}).`;
      } else {
        context = `${context} The user gave no email. Ask once whether they can paste the approval email to prove the rule; if not, save it as their word.`;
      }
      sendToAgentChat({ message, context, submit: true });
    } catch (error) {
      toast.error(actionErrorMessage(error));
    }
  };
};

export function FindingsList({
  detail,
  selectedId,
  onSelect,
}: {
  detail: VendorDetail;
  selectedId: string | undefined;
  onSelect: (finding: Finding) => void;
}) {
  const reviewOnServer = useReview(detail.vendor);
  const [stamps, setStamps] = useState<Record<string, "accept" | "reject">>({});
  /** Stamp first (instant feedback), then save. */
  const review: Review = async (findings, decision, reason, approval) => {
    setStamps((current) => ({ ...current, ...Object.fromEntries(findings.map((f) => [f.id, decision])) }));
    window.setTimeout(
      () => setStamps((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !findings.some((f) => f.id === id)))),
      1400,
    );
    await reviewOnServer(findings, decision, reason, approval);
  };
  const [rejecting, setRejecting] = useState<Rejecting>(null);
  const byId = new Map(detail.findings.map((finding) => [finding.id, finding]));
  const severities = [...new Set(detail.findingGroups.map((group) => group.severity))];
  const groupsOf = (severity: string) => detail.findingGroups.filter((group) => group.severity === severity);
  const ordered = severities.flatMap((severity) => groupsOf(severity).flatMap((group) => group.findingIds.flatMap((id) => byId.get(id) ?? [])));

  useTriageKeys({
    ordered,
    selectedId,
    onSelect,
    onAccept: (finding) => void review([finding], "accept"),
    onReject: (finding) => setRejecting([finding]),
  });

  if (detail.findings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-rule p-6 text-center text-sm text-muted-foreground">
        No findings yet. Once the agent has recorded the terms and bills, the audit runs here.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KeyHints />
      {severities.map((severity) => (
        <section key={severity} className="space-y-2">
          <LedgerHeading>{SEVERITY_TITLES[severity] ?? severity}</LedgerHeading>
          <div className="divide-y divide-rule rounded-md border border-rule bg-card">
            {groupsOf(severity).map((group) => (
                <FindingGroup
                  key={group.check}
                  group={group}
                  findings={group.findingIds.flatMap((id) => byId.get(id) ?? [])}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  review={review}
                  stamps={stamps}
                  rejecting={rejecting}
                  setRejecting={setRejecting}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FindingGroup({
  group,
  findings,
  selectedId,
  onSelect,
  review,
  stamps,
  rejecting: rejectingAny,
  setRejecting: setRejectingAny,
}: {
  group: Group;
  findings: Finding[];
  selectedId: string | undefined;
  onSelect: (finding: Finding) => void;
  review: Review;
  stamps: Record<string, "accept" | "reject">;
  rejecting: Rejecting;
  setRejecting: (value: Rejecting) => void;
}) {
  const containsSelected = findings.some((finding) => finding.id === selectedId);
  const [open, setOpen] = useState(containsSelected || findings.length <= 2);
  /** Keyboard navigation can land inside a closed group: open it. */
  useEffect(() => {
    if (containsSelected) setOpen(true);
  }, [containsSelected]);
  const rejecting = rejectingAny?.every((finding) => findings.includes(finding)) ? rejectingAny : null;
  const setRejecting = setRejectingAny;
  const isDeadline = group.severity === "deadline";
  const months = findings.length === 1 ? findings[0]?.periodLabel : `${findings.length} ${isDeadline ? "items" : "months"}`;

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <IconChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{group.label}</span>
            <span className="block text-xs text-muted-foreground">
              {months}
              {group.standingCount < group.count && ` · ${group.count - group.standingCount} resolved`}
            </span>
          </span>
        </button>
        <Money
          cents={group.amountCents}
          className={cn("text-sm", group.standingCount === 0 ? "text-muted-foreground" : isDeadline ? "text-amber" : "text-notch")}
        />
        <ReviewButtons onAccept={() => void review(findings, "accept")} onReject={() => setRejecting(findings)} label={`all ${group.label}`} />
      </div>
      {rejecting && rejecting.length > 1 && (
        <RejectBox count={rejecting.length} onCancel={() => setRejecting(null)} onSubmit={(reason, approval) => void review(rejecting, "reject", reason, approval).then(() => setRejecting(null))} />
      )}
      {open && (
        <ul className="pb-1">
          {findings.map((finding) => (
            <li key={finding.id} data-finding-id={finding.id}>
              <div
                className={cn(
                  "group relative flex items-center gap-2 py-1.5 pl-9 pr-3 text-sm",
                  finding.id === selectedId ? "bg-shade" : "hover:bg-shade/60",
                )}
              >
                {stamps[finding.id] && <Stamp kind={stamps[finding.id]!} />}
                <button type="button" onClick={() => onSelect(finding)} title={finding.explanation} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="min-w-0 flex-1 truncate">
                    {finding.periodLabel}
                    {finding.invoiceNumber && <span className="ml-1.5 text-xs text-muted-foreground">{finding.invoiceNumber}</span>}
                    {finding.meter && <span className="ml-1.5 text-xs text-muted-foreground">{finding.meter}</span>}
                  </span>
                  <StatusChip status={finding.status} />
                  <Money cents={isDeadline ? finding.atRiskCents : finding.amountCents} className="w-24 text-right text-sm" />
                </button>
                <ReviewButtons onAccept={() => void review([finding], "accept")} onReject={() => setRejecting([finding])} label={finding.title} />
              </div>
              {rejecting?.length === 1 && rejecting[0]?.id === finding.id && (
                <RejectBox count={1} onCancel={() => setRejecting(null)} onSubmit={(reason, approval) => void review([finding], "reject", reason, approval).then(() => setRejecting(null))} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewButtons({ onAccept, onReject, label }: { onAccept: () => void; onReject: () => void; label: string }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      <Button variant="ghost" size="icon-xs" onClick={onAccept} aria-label={`Accept ${label}`} title="Accept: it's an overcharge">
        <IconCheck className="size-3.5 text-verified" />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={onReject} aria-label={`Reject ${label}`} title="Reject: it's legitimate">
        <IconX className="size-3.5" />
      </Button>
    </span>
  );
}

function RejectBox({ count, onCancel, onSubmit }: { count: number; onCancel: () => void; onSubmit: (reason: string, approval: string) => void }) {
  const [reason, setReason] = useState("");
  const [approval, setApproval] = useState("");
  const [showApproval, setShowApproval] = useState(false);

  return (
    <form
      className="tally-slide-in mx-3 mb-2 space-y-2 rounded-md border border-rule bg-background p-3"
      onKeyDown={(event) => event.key === "Escape" && onCancel()}
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim()) onSubmit(reason.trim(), approval);
      }}
    >
      <label className="block text-xs font-medium" htmlFor="reject-reason">
        Why is this OK?{count > 1 && ` (${count} findings)`}
      </label>
      <textarea
        id="reject-reason"
        autoFocus
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="We approved 48 seats by email on 28 March."
        className="w-full resize-none rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      />
      {showApproval ? (
        <textarea
          rows={4}
          value={approval}
          onChange={(event) => setApproval(event.target.value)}
          placeholder="Paste the email that approved it. Its approval line becomes the proof."
          aria-label="Approval email"
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 font-figure text-xs"
        />
      ) : (
        <button type="button" onClick={() => setShowApproval(true)} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Have the email? Paste it as proof
        </button>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!reason.trim()}>
          Reject and teach
        </Button>
      </div>
    </form>
  );
}

/** Ink on paper: the decision lands on the row before the server answers. */
function Stamp({ kind }: { kind: "accept" | "reject" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ink-stamp pointer-events-none absolute left-1/2 top-1/2 z-10 rounded-sm border-[3px] border-double px-2 font-figure text-sm font-bold uppercase tracking-[0.2em]",
        kind === "accept" ? "border-notch text-notch" : "border-muted-foreground text-muted-foreground",
      )}
    >
      {kind === "accept" ? "Dispute" : "Waived"}
    </span>
  );
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** J/K walk the findings (the evidence follows), D stamps dispute, W opens "why is this OK?". */
function useTriageKeys({
  ordered,
  selectedId,
  onSelect,
  onAccept,
  onReject,
}: {
  ordered: Finding[];
  selectedId: string | undefined;
  onSelect: (finding: Finding) => void;
  onAccept: (finding: Finding) => void;
  onReject: (finding: Finding) => void;
}) {
  useEffect(() => {
    const index = ordered.findIndex((finding) => finding.id === selectedId);
    const go = (finding: Finding | undefined) => {
      if (!finding) return;
      onSelect(finding);
      requestAnimationFrame(() => document.querySelector(`[data-finding-id="${finding.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      const current = ordered[index];
      if (key === "j") go(ordered[index + 1] ?? (index === -1 ? ordered[0] : undefined));
      else if (key === "k") go(ordered[index - 1] ?? (index === -1 ? ordered[0] : undefined));
      else if (key === "d" && current && REVIEWABLE.has(current.status)) {
        onAccept(current);
        window.setTimeout(() => go(ordered[index + 1]), 450);
      } else if (key === "w" && current && REVIEWABLE.has(current.status)) onReject(current);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, selectedId, onSelect, onAccept, onReject]);
}

function KeyHints() {
  const key = "inline-flex min-w-5 justify-center rounded border border-rule bg-card px-1 font-figure text-[10px] text-foreground shadow-[0_1px_0_var(--color-rule)]";
  return (
    <p className="hidden items-center gap-3 text-[11px] text-muted-foreground lg:flex" aria-hidden="true">
      <span>
        <kbd className={key}>J</kbd> <kbd className={key}>K</kbd> walk the findings
      </span>
      <span>
        <kbd className={key}>D</kbd> dispute it
      </span>
      <span>
        <kbd className={key}>W</kbd> waive it, with a reason
      </span>
    </p>
  );
}
