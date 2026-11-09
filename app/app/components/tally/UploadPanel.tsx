import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction } from "@agent-native/core/client/hooks";
import { IconFileText, IconUpload, IconX } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DocumentKind, type ExtractedFile, extractText } from "@/lib/extract-text";
import type { Overview } from "@/lib/tally";

const KIND_LABELS: Record<DocumentKind, string> = {
  contract: "Contract",
  amendment: "Amendment",
  invoice: "Invoice",
  usage_export: "Usage export",
  note: "Email / note",
};

type VendorKind = "seat_subscription" | "usage_metered";
const NEW_VENDOR = "__new__";

/**
 * Upload bills and contracts for a vendor. Text is extracted here in the
 * browser; the actions store it; the agent then reads and records it.
 */
export function UploadPanel({ vendors, onClose, defaultVendorId }: { vendors: Overview["vendors"]; onClose: () => void; defaultVendorId?: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [vendorId, setVendorId] = useState(defaultVendorId ?? vendors[0]?.id ?? NEW_VENDOR);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<VendorKind>("seat_subscription");
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy("reading");
    try {
      const extracted = await Promise.all([...list].map(extractText));
      const empty = extracted.filter((file) => file.text.length === 0);
      if (empty.length > 0) toast.error(`No text found in ${empty.map((f) => f.name).join(", ")}. Scanned PDFs need OCR first.`);
      setFiles((current) => [...current, ...extracted.filter((file) => file.text.length > 0)]);
    } catch (error) {
      toast.error(`Could not read that file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const setKind = (index: number, kind: DocumentKind) =>
    setFiles((current) => current.map((file, i) => (i === index ? { ...file, kind } : file)));

  const submit = async () => {
    if (files.length === 0) return;
    setBusy("saving");
    try {
      let targetId = vendorId;
      let vendorName = vendors.find((v) => v.id === vendorId)?.name ?? "";
      if (vendorId === NEW_VENDOR) {
        if (!newName.trim()) {
          toast.error("Name the vendor first.");
          return;
        }
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
      toast.success(added === files.length ? `Added ${added} documents to ${vendorName}.` : `Added ${added}; ${files.length - added} were already there.`);
      sendToAgentChat({
        message: `Audit ${vendorName}`,
        context: `The user just uploaded ${files.length} document(s) for vendor ${vendorName} (id ${targetId}): ${files.map((f) => `${f.name} [${f.kind}]`).join(", ")}. Use the audit-vendor skill.`,
        submit: true,
      });
      onClose();
    } catch (error) {
      toast.error(actionErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="tally-slide-in rounded-md border border-rule bg-card p-5" aria-label="Upload documents">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="ledger-numeral text-xl font-medium">Add bills and contracts</h2>
          <p className="mt-1 text-sm text-muted-foreground">PDF, CSV or text. Text is extracted in your browser; the agent reads it and quotes every figure.</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <IconX className="size-4" />
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground" htmlFor="upload-vendor">
            Vendor
          </label>
          <select
            id="upload-vendor"
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
            <option value={NEW_VENDOR}>New vendor…</option>
          </select>
          {vendorId === NEW_VENDOR && (
            <div className="space-y-2">
              <Input placeholder="Vendor name, as on the bill" value={newName} onChange={(event) => setNewName(event.target.value)} />
              <div className="flex gap-2 text-sm" role="radiogroup" aria-label="Billing model">
                {(["seat_subscription", "usage_metered"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={newKind === kind}
                    onClick={() => setNewKind(kind)}
                    className={`flex-1 rounded-md border px-2 py-1.5 ${newKind === kind ? "border-foreground bg-foreground text-background" : "border-input"}`}
                  >
                    {kind === "seat_subscription" ? "Per seat" : "Usage"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Files</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void addFiles(event.dataTransfer.files);
            }}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-rule px-4 py-6 text-sm text-muted-foreground hover:border-foreground/40"
          >
            <IconUpload className="size-5" />
            {busy === "reading" ? "Reading…" : "Drop files or click to choose"}
          </button>
          <input ref={inputRef} type="file" multiple accept=".pdf,.csv,.txt,.eml,.md" className="hidden" onChange={(event) => void addFiles(event.target.files)} />
          {files.length > 0 && (
            <ul className="divide-y divide-rule rounded-md border border-rule">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <IconFileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <select
                    value={file.kind}
                    onChange={(event) => setKind(index, event.target.value as DocumentKind)}
                    aria-label={`Kind of ${file.name}`}
                    className="h-7 rounded border border-input bg-background px-1 text-xs"
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
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <IconX className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={files.length === 0 || busy !== null}>
          {busy === "saving" ? "Saving…" : `Add ${files.length || ""} and audit`}
        </Button>
      </div>
    </section>
  );
}
