import { useParams } from "react-router";

import { EvidenceView } from "@/components/tally/EvidenceView";

export default function FindingRoute() {
  const { findingId = "" } = useParams();
  return <EvidenceView key={findingId} findingId={findingId} />;
}
