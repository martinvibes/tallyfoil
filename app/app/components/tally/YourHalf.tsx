import { actionErrorMessage, callAction } from "@agent-native/core/client/hooks";
import { setClientAppState } from "@agent-native/core/client/application-state";
import { IconFileText, IconMailCheck, IconMessage, IconPencil, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { VendorDetail } from "@/lib/tally";
import { cn } from "@/lib/utils";
import { pathForLocation } from "@shared/routes";

import { LedgerHeading, SourceBadge } from "./primitives";

type Term = VendorDetail["terms"][number];
type Rule = VendorDetail["rules"][number];

const useRefresh = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
};

/** The customer's half of the tally: what was agreed, what they taught the audit, and the source documents. */
export function YourHalf({ detail }: { detail: VendorDetail }) {
  const activeRules = detail.rules.filter((rule) => rule.active);
  return (
    <div className="grid gap-6 @3xl:grid-cols-[1.4fr_1fr_1fr] @3xl:items-start">
      <section className="space-y-2">
        <LedgerHeading>What was agreed</LedgerHeading>
        {detail.terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No terms recorded yet.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-md border border-rule bg-card">
            {detail.terms.map((term) => (
              <TermRow key={term.id} term={term} vendorId={detail.vendor.id} />
            ))}
          </ul>
        )}
      </section>

      {activeRules.length > 0 ? (
        <section className="space-y-2">
          <LedgerHeading>What you taught it</LedgerHeading>
          <ul className="space-y-2">
            {activeRules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} />
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-2">
          <LedgerHeading>What you taught it</LedgerHeading>
          <p className="rounded-md border border-dashed border-rule p-3 text-xs text-muted-foreground">
            Reject a finding with a reason and the audit learns it. Paste the approving email and the rule is proven, not just your word.
          </p>
        </section>
      )}

      <section className="space-y-2">
        <LedgerHeading>Documents</LedgerHeading>
        <ul className="space-y-1">
          {detail.documents.map((document) => (
            <li key={document.id}>
              <Link
                to={pathForLocation({ view: "document", documentId: document.id })}
                className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-shade"
              >
                <IconFileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{document.name}</span>
                <span className={cn("text-[10px] uppercase tracking-wide", document.status === "new" ? "text-amber" : "text-muted-foreground")}>
                  {document.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TermRow({ term, vendorId }: { term: Term; vendorId: string }) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(term.value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft.trim() === term.value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const result = await callAction<{ message: string }>("update-term", { termId: term.id, value: draft.trim(), expectedRevision: term.revision });
      await refresh();
      toast.success(result.message);
      setEditing(false);
    } catch (error) {
      toast.error(actionErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const select = () =>
    void setClientAppState("selection", { kind: "term", vendorId, termId: term.id, label: `${term.label}: ${term.value}` });

  return (
    <li className="px-3 py-2" onClick={select}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {term.label}
          {term.meter && <span className="ml-1">· {term.meter}</span>}
        </span>
        <SourceBadge source={term.source} />
      </div>
      {editing ? (
        <form
          className="mt-1 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
            aria-label={`New value for ${term.label}`}
            className="figure h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm"
          />
          <Button type="submit" size="xs" disabled={saving}>
            {saving ? "…" : "Save"}
          </Button>
        </form>
      ) : (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="figure text-[15px]">{term.value}</span>
          {term.effectiveFrom && <span className="text-xs text-muted-foreground">from {term.effectiveFrom}</span>}
          <span className="flex-1" />
          {term.evidence && <EvidenceChip evidence={term.evidence} />}
          <button
            type="button"
            onClick={() => {
              setDraft(term.value);
              setEditing(true);
            }}
            aria-label={`Edit ${term.label}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <IconPencil className="size-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

function EvidenceChip({ evidence }: { evidence: NonNullable<Term["evidence"]> }) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Link
          to={pathForLocation({ view: "document", documentId: evidence.documentId })}
          className="rounded-sm border border-verified/40 px-1 text-[10px] font-medium uppercase tracking-wide text-verified"
        >
          quoted
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 space-y-2 text-xs">
        <p className="text-muted-foreground">{evidence.documentName}</p>
        {evidence.quotes.map((quote) => (
          <blockquote key={quote} className="evidence-mark-agreed font-figure">
            {quote}
          </blockquote>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const refresh = useRefresh();
  const remove = async () => {
    try {
      const result = await callAction<{ message: string }>("remove-vendor-rule", { ruleId: rule.id });
      await refresh();
      toast.success(result.message);
    } catch (error) {
      toast.error(actionErrorMessage(error));
    }
  };

  return (
    <li className="rounded-md border border-rule bg-card p-3 text-sm">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium">{rule.description}</p>
        <button type="button" onClick={remove} aria-label="Remove rule" className="text-muted-foreground hover:text-notch">
          <IconTrash className="size-3.5" />
        </button>
      </div>
      <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{rule.reason}&rdquo;</p>
      {rule.proof ? (
        <div className="mt-2 space-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-verified">
            <IconMailCheck className="size-3.5" /> Proven by email
          </span>
          {rule.proof.quotes.map((quote) => (
            <blockquote key={quote} className="evidence-mark-agreed font-figure text-xs">
              {quote}
            </blockquote>
          ))}
        </div>
      ) : (
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber">
          <IconMessage className="size-3.5" /> Your word
        </span>
      )}
    </li>
  );
}
