import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction } from "@agent-native/core/client/hooks";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@agent-native/toolkit/ui/dialog";
import { IconArrowRight, IconFileText, IconLoader2, IconLock, IconUpload, IconX } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DocumentKind, type ExtractedFile, extractText } from "@/lib/extract-text";
import { cn } from "@/lib/utils";

import { TallyfoilMark } from "./TallyfoilMark";

const KIND_LABELS: Record<DocumentKind, string> = {
  contract: "Contract",
  amendment: "Amendment",
  invoice: "Invoice",
  usage_export: "Usage export",
  note: "Email / note",
};

type VendorKind = "seat_subscription" | "usage_metered";
const NEW_VENDOR = "__new__";

const BILLING_MODELS: { kind: VendorKind; label: string; hint: string }[] = [
  { kind: "seat_subscription", label: "Per seat", hint: "Licenses billed each month" },
  { kind: "usage_metered", label: "Usage", hint: "Tokens, calls or units" },
];

const fieldLabel = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

/**
 * The upload modal. Text is extracted here in the browser; the actions store
 * it; the agent then reads and records it, and audits the vendor.
 */
export function UploadPanel({
  vendors,
  onClose,
  defaultVendorId,
}: {
  vendors: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
  defaultVendorId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [vendorId, setVendorId] = useState(defaultVendorId ?? vendors[0]?.id ?? NEW_VENDOR);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<VendorKind>("seat_subscription");
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [dragging, setDragging] = useState(false);

  const isNew = vendorId === NEW_VENDOR;
  const missingName = isNew && newName.trim().length === 0;
  const blocker = files.length === 0 ? "Add at least one file." : missingName ? "Name the vendor." : null;

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy("reading");
    try {
      const extracted = await Promise.all([...list].map(extractText));
      const empty = extracted.filter((file) => file.text.length === 0);
      if (empty.length > 0) {
        toast.error(`No text found in ${empty.map((f) => f.name).join(", ")}`, { description: "Scanned PDFs need OCR first. Try the text version or a CSV export." });
      }
      setFiles((current) => [...current, ...extracted.filter((file) => file.text.length > 0)]);
    } catch (error) {
      toast.error("Couldn't read that file", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const setKind = (index: number, kind: DocumentKind) => setFiles((current) => current.map((file, i) => (i === index ? { ...file, kind } : file)));

  const submit = async () => {
    if (blocker) return;
    setBusy("saving");
    try {
      let targetId = vendorId;
      let vendorName = vendors.find((v) => v.id === vendorId)?.name ?? "";
      if (isNew) {
        const created = await callAction<{ id: string; vendor: { name: string } }>("create-vendor", { name: newName.trim(), kind: newKind });
        targetId = created.id;
        vendorName = created.vendor.name;
      }
      let added = 0;
      for (const file of files) {
        const result = await callAction<{ duplicate: boolean }>("add-document", { vendorId: targetId, kind: file.kind, name: file.name, text: file.text });
        if (!result.duplicate) added += 1;
      }
      await queryClient.invalidateQueries();
      toast.success(added === files.length ? `Added ${added} document${added === 1 ? "" : "s"} to ${vendorName}` : `Added ${added}; ${files.length - added} were already there`, {
        description: "The agent is auditing now. Follow along in the chat.",
      });
      sendToAgentChat({
        message: `Audit ${vendorName}`,
        context: `The user just uploaded ${files.length} document(s) for vendor ${vendorName} (id ${targetId}): ${files.map((f) => `${f.name} [${f.kind}]`).join(", ")}. Use the audit-vendor skill.`,
        submit: true,
      });
      onClose();
    } catch (error) {
      toast.error("Couldn't add those documents", { description: actionErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && busy !== "saving" && onClose()}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl" closeLabel="Close">
        <div className="night-panel relative shrink-0 px-6 pb-5 pt-6">
          <div className="flex items-center gap-2.5">
            <TallyfoilMark className="size-7 rounded-[8px] ring-1 ring-white/15" />
            <span className="font-figure text-[11px] uppercase tracking-[0.22em] text-white/55">Tallyfoil</span>
          </div>
          <DialogTitle className="mt-4 font-ledger text-2xl font-medium sm:text-3xl leading-tight tracking-tight text-[#f6efe4]">
            Add both halves of the deal
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-lg text-sm leading-relaxed text-white/60">
            The contract says what you agreed. The bills say what you paid. Drop them in and Tallyfoil proves every place they disagree.
          </DialogDescription>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[1fr_1.3fr]">
          <div className="space-y-3">
            <label className={fieldLabel} htmlFor="upload-vendor">
              Vendor
            </label>
            <select
              id="upload-vendor"
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-notch focus-visible:ring-2 focus-visible:ring-notch/20"
            >
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
              <option value={NEW_VENDOR}>+ New vendor</option>
            </select>
            {isNew && (
              <div className="space-y-3">
                <Input
                  placeholder="Vendor name, as on the bill"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  aria-label="Vendor name"
                  className="h-10 rounded-lg"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How this vendor bills">
                  {BILLING_MODELS.map(({ kind, label, hint }) => (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={newKind === kind}
                      onClick={() => setNewKind(kind)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notch/40",
                        newKind === kind ? "border-notch bg-notch/[0.07]" : "border-input hover:border-foreground/30",
                      )}
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <span className={fieldLabel}>Files</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void addFiles(event.dataTransfer.files);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notch/40",
                dragging ? "border-notch bg-notch/[0.06]" : "border-rule hover:border-foreground/30 hover:bg-shade/50",
              )}
            >
              <span className={cn("flex size-10 items-center justify-center rounded-full", dragging ? "bg-notch text-white" : "bg-shade text-foreground")}>
                {busy === "reading" ? <IconLoader2 className="size-5 animate-spin" /> : <IconUpload className="size-5" />}
              </span>
              <span className="text-sm font-medium">{busy === "reading" ? "Reading your files…" : dragging ? "Drop to add" : "Drop files here or click to choose"}</span>
              <span className="font-figure text-[10px] uppercase tracking-[0.14em] text-muted-foreground">PDF · CSV · TXT · EML</span>
            </button>
            <input ref={inputRef} type="file" multiple accept=".pdf,.csv,.txt,.eml,.md" className="hidden" onChange={(event) => void addFiles(event.target.files)} />
            {files.length > 0 && (
              <ul className="max-h-48 divide-y divide-rule overflow-y-auto rounded-lg border border-rule">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <IconFileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <select
                      value={file.kind}
                      onChange={(event) => setKind(index, event.target.value as DocumentKind)}
                      aria-label={`Kind of ${file.name}`}
                      className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                    >
                      {Object.entries(KIND_LABELS).map(([kind, label]) => (
                        <option key={kind} value={kind}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Remove ${file.name}`}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <IconX className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-rule bg-shade/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconLock className="size-3.5 shrink-0" aria-hidden="true" />
            Read in your browser. Only the text is sent.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy === "saving"}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={blocker !== null || busy !== null} title={blocker ?? undefined} className="bg-notch text-white hover:bg-notch/90">
              {busy === "saving" ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" /> Adding…
                </>
              ) : (
                <>
                  {files.length > 0 ? `Add ${files.length} and audit` : "Add and audit"} <IconArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
