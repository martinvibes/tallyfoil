import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { IconMailCheck, IconMessageQuestion } from "@tabler/icons-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import type { FindingDetail } from "@/lib/tally";
import { cn } from "@/lib/utils";
import { pathForLocation } from "@shared/routes";

import { LedgerHeading, Money, SampleBadge, SeverityLabel, StatusChip } from "./primitives";

type Block = FindingDetail["bill"][number];
type Quote = Block["quotes"][number];

/**
 * The hero: both halves of the proof for one finding. Their half (the bill)
 * on top, the foil edge, the math, then your half (contract or usage).
 */
export function EvidenceView({ findingId }: { findingId: string }) {
  const { data, isLoading } = useActionQuery<FindingDetail | null>("get-finding", { findingId });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Pulling the evidence…</div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">This finding is no longer on the ledger.</div>;

  const { finding, bill, agreed, math, vendor } = data;
  const isDeadline = finding.severity === "deadline";
  const explainingRules = agreed.rules.filter((rule) => rule.explainsThis);

  return (
    <article className="tally-slide-in space-y-4" aria-label={`Evidence for ${finding.title}`}>
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityLabel severity={finding.severity} />
          <StatusChip status={finding.status} />
          {vendor.isSample && <SampleBadge />}
        </div>
        <h2 className="ledger-numeral text-2xl font-medium leading-tight">{finding.title}</h2>
        <div className="flex items-baseline gap-2">
          <Money cents={isDeadline ? finding.atRiskCents : finding.amountCents} className={cn("text-3xl", isDeadline ? "text-amber" : "text-notch")} />
          <span className="text-sm text-muted-foreground">{isDeadline ? "at risk" : "overcharged"}</span>
        </div>
        <p className="text-sm text-muted-foreground">{finding.explanation}</p>
        {finding.rejectReason && <p className="text-sm italic text-muted-foreground">Rejected: &ldquo;{finding.rejectReason}&rdquo;</p>}
      </header>

      <Half title="Their half · the bill" empty="This finding is about a date, not a bill line." className="half-from-top">
        {bill.map((block) => (
          <QuoteBlock key={`${block.documentId}-${block.label}`} block={block} tone="bill" />
        ))}
      </Half>

      <div className="foil-edge" aria-hidden="true" />
      <MathStrip math={math} />
      <div className="foil-edge rotate-180" aria-hidden="true" />

      <Half title="Your half · what was agreed" empty="" className="half-from-bottom">
        {agreed.terms.map((block) => (
          <QuoteBlock key={`${block.documentId}-${block.label}`} block={block} tone="agreed" />
        ))}
        {agreed.usage.map((usage) => (
          <div key={usage.id} className="rounded-md border border-rule bg-card p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              <Link to={pathForLocation({ view: "document", documentId: usage.documentId })} className="hover:underline">
                {usage.documentName}
              </Link>
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">{usage.label}: </span>
              <span className="figure evidence-mark-agreed">{usage.quantityLabel}</span>
            </p>
          </div>
        ))}
        {agreed.rules
          .filter((rule) => !rule.explainsThis)
          .map((rule) => (
            <RuleNote key={rule.id} rule={rule} />
          ))}
      </Half>

      {explainingRules.length > 0 && (
        <section className="space-y-2">
          <LedgerHeading>Explained by your rule</LedgerHeading>
          {explainingRules.map((rule) => (
            <RuleNote key={rule.id} rule={rule} />
          ))}
        </section>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          sendToAgentChat({
            message: `Explain this finding: ${finding.title}`,
            context: `Finding ${finding.id} (${finding.checkLabel}, ${finding.periodLabel}). Math: ${math.formula} = ${math.result}. Use get-finding for the quotes; cite them.`,
            submit: true,
          })
        }
      >
        <IconMessageQuestion className="size-4" /> Ask why
      </Button>
    </article>
  );
}

function Half({ title, empty, children, className }: { title: string; empty: string; children: React.ReactNode; className?: string }) {
  const hasContent = Array.isArray(children) ? children.flat().some(Boolean) : Boolean(children);
  return (
    <section className={cn("space-y-2", className)}>
      <LedgerHeading>{title}</LedgerHeading>
      {hasContent ? <div className="space-y-2">{children}</div> : empty && <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function QuoteBlock({ block, tone }: { block: Block; tone: "bill" | "agreed" }) {
  return (
    <div className="overflow-hidden rounded-md border border-rule bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-1.5 text-xs">
        <span className="min-w-0 truncate font-medium">{block.label}</span>
        <Link to={pathForLocation({ view: "document", documentId: block.documentId })} className="shrink-0 text-muted-foreground hover:text-foreground hover:underline">
          {block.documentName}
        </Link>
      </div>
      {block.quotes.map((quote, index) => (
        <Excerpt key={index} quote={quote} tone={tone} />
      ))}
    </div>
  );
}

/** The lines around a quote with line numbers, the quote itself marked. */
function Excerpt({ quote, tone }: { quote: Quote; tone: "bill" | "agreed" }) {
  const before = quote.text.slice(0, quote.highlightStart);
  const marked = quote.text.slice(quote.highlightStart, quote.highlightEnd);
  const after = quote.text.slice(quote.highlightEnd);
  const lineCount = quote.text.split("\n").length;

  return (
    <div className="flex overflow-x-auto border-rule font-figure text-[12px] leading-5 [&+&]:border-t">
      <div className="select-none border-r border-rule px-2 py-2 text-right text-muted-foreground/70" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{quote.firstLine + i}</div>
        ))}
      </div>
      <pre className="min-w-0 flex-1 whitespace-pre px-3 py-2">
        {before}
        <mark className={tone === "bill" ? "evidence-mark-bill" : "evidence-mark-agreed"}>{marked}</mark>
        {after}
      </pre>
    </div>
  );
}

const humanize = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const looksLikeMoney = (value: string) => /^-?[\d,]+\.\d{2}$/.test(value);

function MathStrip({ math }: { math: FindingDetail["math"] }) {
  const inputs = Object.entries(math).filter(([key]) => key !== "formula" && key !== "result");
  const result = String(math.result);
  return (
    <section className="rounded-md bg-shade px-3 py-2.5" aria-label="How the amount was computed">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">The arithmetic · computed by code</p>
      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {inputs.map(([key, value]) => (
          <div key={key} className="flex gap-1">
            <dt className="text-muted-foreground">{humanize(key)}</dt>
            <dd className="figure">{String(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="figure mt-1.5 text-sm">
        {math.formula} = <strong className="font-medium">{looksLikeMoney(result) ? `$${result}` : result}</strong>
      </p>
    </section>
  );
}

function RuleNote({ rule }: { rule: FindingDetail["agreed"]["rules"][number] }) {
  return (
    <div className="rounded-md border border-rule bg-card p-3 text-sm">
      <p className="font-medium">{rule.description}</p>
      <p className="mt-0.5 text-xs italic text-muted-foreground">&ldquo;{rule.reason}&rdquo;</p>
      {rule.proof ? (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-verified">
            <IconMailCheck className="size-3.5" /> Proven by email
          </span>
          {rule.proof.quotes.map((quote, index) => (
            <Excerpt key={index} quote={quote} tone="agreed" />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber">Your word</p>
      )}
    </div>
  );
}
