/**
 * Tallyfoil's screens and their URLs, shared by the browser (route state)
 * and the server (`navigate`, `view-screen`) so both agree on what a path means.
 */

export type TallyView = "home" | "vendor" | "finding" | "document" | "dispute";

export interface TallyLocation {
  view: TallyView;
  vendorId?: string;
  findingId?: string;
  documentId?: string;
  disputeId?: string;
}

export const OVERVIEW_PATH = "/home";

const segment = (id: string) => encodeURIComponent(id);

export const pathForLocation = (location: TallyLocation): string => {
  switch (location.view) {
    case "vendor":
      return location.vendorId ? `/vendors/${segment(location.vendorId)}` : OVERVIEW_PATH;
    case "finding":
      return location.vendorId && location.findingId
        ? `/vendors/${segment(location.vendorId)}/findings/${segment(location.findingId)}`
        : OVERVIEW_PATH;
    case "document":
      return location.documentId ? `/documents/${segment(location.documentId)}` : OVERVIEW_PATH;
    case "dispute":
      return location.disputeId ? `/disputes/${segment(location.disputeId)}` : OVERVIEW_PATH;
    case "home":
      return OVERVIEW_PATH;
  }
};

/** The Tallyfoil screen a path shows, or null for framework screens (chat, settings…). */
export const locationForPath = (pathname: string): TallyLocation | null => {
  if (pathname === OVERVIEW_PATH) return { view: "home" };
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [root, id, child, childId] = parts;
  if (root === "vendors" && id) {
    return child === "findings" && childId ? { view: "finding", vendorId: id, findingId: childId } : { view: "vendor", vendorId: id };
  }
  if (root === "documents" && id) return { view: "document", documentId: id };
  if (root === "disputes" && id) return { view: "dispute", disputeId: id };
  return null;
};
