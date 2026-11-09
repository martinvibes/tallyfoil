import { actionErrorMessage, callAction, useActionQuery } from "@agent-native/core/client/hooks";
import { IconArrowLeft, IconCheck, IconCopy, IconLock, IconMail, IconShieldCheck, IconShieldX } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type DisputeView, findMoneyTokens, formatUsd } from "@/lib/tally";
import { cn } from "@/lib/utils";
import { OVERVIEW_PATH, pathForLocation } from "@shared/routes";

import { CountUpMoney, SampleBadge } from "./primitives";

type Field = "subject" | "intro" | "closing";
type Prose = Record<Field, string>;
type Line = DisputeView["lines"][number];

interface CheckedAmount {
  text: string;
  index: number;
  cents: number;
  /** The itemized line (or "Total") this amount matches; null when code never computed it. */
  source: string | null;
}

/** The same rule the server enforces: an amount in the prose must be a line amount or the total. */
const checkProse = (text: string, lines: readonly Line[], totalCents: number): CheckedAmount[] =>
  findMoneyTokens(text).map((token) => {
    const line = lines.find((l) => l.amountCents === token.cents);
    const source = line ? `${line.periodLabel}${line.invoiceNumber ? ` · ${line.invoiceNumber}` : ""}` : token.cents === totalCents ? "the total" : null;
    return { text: token.text, index: token.index, cents: token.cents, source };
  });

export function DisputeComposer() {
  const { disputeId = "" } = useParams();
  const { data, isLoading } = useActionQuery<DisputeView>("get-dispute", { disputeId }, { enabled: Boolean(disputeId) });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Opening the draft…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">This dispute isn&rsquo;t on your ledger.</div>;
  return <Composer key={`${data.id}-${data.revision}`} dispute={data} />;
}

function Composer({ dispute }: { dispute: DisputeView }) {
  const queryClient = useQueryClient();
  const [prose, setProse] = useState<Prose>({ subject: dispute.subject, intro: dispute.intro, closing: dispute.closing });
  const [saving, setSaving] = useState<"save" | "approve" | null>(null);
  const approved = dispute.status === "approved";
  const dirty = prose.subject !== dispute.subject || prose.intro !== dispute.intro || prose.closing !== dispute.closing;

  const checks = useMemo(
    () => ({
      subject: checkProse(prose.subject, dispute.lines, dispute.totalCents),
      intro: checkProse(prose.intro, dispute.lines, dispute.totalCents),
      closing: checkProse(prose.closing, dispute.lines, dispute.totalCents),
    }),
    [prose, dispute.lines, dispute.totalCents],
  );
  const invented = [...checks.subject, ...checks.intro, ...checks.closing].filter((amount) => amount.source === null);
  const verified = [...checks.subject, ...checks.intro, ...checks.closing].filter((amount) => amount.source !== null);

  const save = async () => {
    setSaving("save");
    try {
      await callAction("update-dispute", { disputeId: dispute.id, ...prose, expectedRevision: dispute.revision });
      await queryClient.invalidateQueries();
      toast.success("Draft saved. Every amount checked out.");
    } catch (error) {
      toast.error(actionErrorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  const approve = async () => {
    setSaving("approve");
    try {
      if (dirty) await callAction("update-dispute", { disputeId: dispute.id, ...prose, expectedRevision: dispute.revision });
      await callAction("approve-dispute", { disputeId: dispute.id });
      await queryClient.invalidateQueries();
      toast.success("Approved. Copy it or open it in your mail app to send.");
    } catch (error) {
      toast.error(actionErrorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${dispute.subject}\n\n${dispute.body}`);
    toast.success("Email copied.");
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <header className="night-panel space-y-4 rounded-2xl px-6 py-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] md:px-8">
        <Link
          to={pathForLocation({ view: "vendor", vendorId: dispute.vendor.id })}
          className="inline-flex items-center gap-1 font-figure text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
        >
          <IconArrowLeft className="size-3.5" /> {dispute.vendor.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-figure text-[11px] uppercase tracking-[0.2em] text-white/45">Dispute to {dispute.vendor.name}</p>
              <span className="rounded-sm border border-white/20 px-1.5 py-px font-figure text-[10px] uppercase tracking-wide text-white/70">{dispute.status}</span>
              {dispute.vendor.isSample && <SampleBadge />}
            </div>
            <CountUpMoney cents={dispute.totalCents} className="silver-text ledger-numeral mt-1 block text-6xl leading-none" />
            <p className="mt-2 text-xs text-white/50">
              {dispute.lines.length} itemized charge{dispute.lines.length === 1 ? "" : "s"}, every one quoted from both documents
            </p>
          </div>
          <GuardBadge invented={invented.length} verified={verified.length} />
        </div>
      </header>

      <div className="space-y-4 rounded-md border border-rule bg-card p-4 md:p-6">
        <GuardedField label="Subject" value={prose.subject} amounts={checks.subject} disabled={approved} singleLine onChange={(subject) => setProse((p) => ({ ...p, subject }))} />
        <GuardedField label="Opening" value={prose.intro} amounts={checks.intro} disabled={approved} onChange={(intro) => setProse((p) => ({ ...p, intro }))} />

        <section className="overflow-hidden rounded-md border border-rule" aria-label="Itemized charges">
          <div className="flex items-center gap-1.5 border-b border-rule bg-shade px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <IconLock className="size-3.5" /> Amounts are computed from your documents
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-rule">
              {dispute.lines.map((line) => (
                <tr key={`${line.periodStart}-${line.issue}-${line.invoiceNumber}`}>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{line.periodLabel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{line.invoiceNumber}</td>
                  <td className="px-3 py-2">{line.issue}</td>
                  <td className="figure whitespace-nowrap px-3 py-2 text-right">{line.amount}</td>
                </tr>
              ))}
              <tr className="bg-shade/60 font-medium">
                <td className="px-3 py-2" colSpan={3}>
                  Total
                </td>
                <td className="figure px-3 py-2 text-right text-notch">{formatUsd(dispute.totalCents)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <GuardedField label="Closing" value={prose.closing} amounts={checks.closing} disabled={approved} onChange={(closing) => setProse((p) => ({ ...p, closing }))} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {approved ? (
          <>
            <Button asChild className="bg-notch text-white hover:bg-notch/90">
              <a href={dispute.mailto}>
                <IconMail className="size-4" /> Open in mail
              </a>
            </Button>
            <Button variant="outline" onClick={() => void copy()}>
              <IconCopy className="size-4" /> Copy email
            </Button>
            <span className="text-sm text-muted-foreground">Approved. You send it; Tallyfoil never does.</span>
          </>
        ) : (
          <>
            <Button onClick={() => void approve()} disabled={invented.length > 0 || saving !== null} className="bg-notch text-white hover:bg-notch/90">
              <IconCheck className="size-4" /> {saving === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button variant="outline" onClick={() => void save()} disabled={!dirty || saving !== null}>
              {saving === "save" ? "Saving…" : "Save draft"}
            </Button>
            <Button variant="ghost" onClick={() => void copy()}>
              <IconCopy className="size-4" /> Copy
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <Link to={OVERVIEW_PATH} className="underline-offset-4 hover:underline">
          Back to the overview
        </Link>
      </p>
    </div>
  );
}

function GuardBadge({ invented, verified }: { invented: number; verified: number }) {
  const blocked = invented > 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
        blocked
          ? "guard-shake border-[#ff4d2e]/70 bg-[#ff4d2e]/15 text-[#ff8a6b] shadow-[0_0_40px_-10px_#ff4d2e]"
          : "border-[#45d4bf]/40 bg-[#45d4bf]/10 text-[#7fe6d6] shadow-[0_0_40px_-16px_#45d4bf]",
      )}
    >
      {blocked ? <IconShieldX className="size-5" /> : <IconShieldCheck className="size-5" />}
      <span>
        <strong className="font-semibold">Number guard</strong>
        <br />
        {blocked
          ? `${invented} amount${invented === 1 ? "" : "s"} not in your documents`
          : verified > 0
            ? `${verified} amount${verified === 1 ? "" : "s"} verified against the ledger`
            : "No amounts in the prose"}
      </span>
    </div>
  );
}

/**
 * A text field that marks every dollar amount as you type: green when code
 * computed it, red when it did not. A mirror layer behind a transparent
 * textarea draws the marks so the caret and selection stay native.
 */
function GuardedField({
  label,
  value,
  amounts,
  onChange,
  disabled,
  singleLine = false,
}: {
  label: string;
  value: string;
  amounts: CheckedAmount[];
  onChange: (value: string) => void;
  disabled: boolean;
  singleLine?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const id = `dispute-${label.toLowerCase()}`;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const segments = useMemo(() => {
    const parts: Array<{ text: string; amount?: CheckedAmount }> = [];
    let cursor = 0;
    for (const amount of amounts) {
      if (amount.index > cursor) parts.push({ text: value.slice(cursor, amount.index) });
      parts.push({ text: amount.text, amount });
      cursor = amount.index + amount.text.length;
    }
    parts.push({ text: value.slice(cursor) + "\n" });
    return parts;
  }, [amounts, value]);

  const invented = amounts.filter((amount) => amount.source === null);
  const shared = cn("w-full whitespace-pre-wrap break-words px-3 py-2 leading-6", singleLine ? "ledger-numeral text-lg" : "text-[15px]");

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <div className={cn("relative rounded-md border bg-background", invented.length > 0 ? "border-notch" : "border-input")}>
        <div ref={mirrorRef} aria-hidden="true" className={cn(shared, "pointer-events-none absolute inset-0 text-transparent")}>
          {segments.map((segment, index) =>
            segment.amount ? (
              <mark key={index} className={segment.amount.source ? "guard-ok" : "guard-bad"}>
                {segment.text}
              </mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </div>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          disabled={disabled}
          spellCheck={false}
          rows={singleLine ? 1 : 3}
          onChange={(event) => onChange(singleLine ? event.target.value.replace(/\n/g, " ") : event.target.value)}
          onScroll={(event) => mirrorRef.current?.scrollTo({ top: event.currentTarget.scrollTop })}
          className={cn(shared, "relative resize-none overflow-hidden bg-transparent outline-none disabled:opacity-80")}
        />
      </div>
      {amounts.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Amounts in ${label}`}>
          {amounts.map((amount) => (
            <li
              key={`${amount.index}-${amount.text}`}
              className={cn(
                "tally-slide-in inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                amount.source ? "border-verified/40 text-verified" : "guard-shake border-notch bg-notch/10 text-notch",
              )}
            >
              {amount.source ? <IconCheck className="size-3" /> : <IconShieldX className="size-3" />}
              <span className="figure">{amount.text}</span>
              <span className="text-muted-foreground">{amount.source ? `= ${amount.source}` : "· code never computed this"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
