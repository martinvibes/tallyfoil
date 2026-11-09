import { OverviewPage } from "@/components/tally/OverviewPage";

const TITLE = "Tallyfoil — every overcharge, proven";
const DESCRIPTION = "Audit vendor bills against what was agreed. Every overcharge is proven with quotes from both documents.";

export function meta() {
  return [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESCRIPTION },
  ];
}

export default function HomeRoute() {
  return <OverviewPage />;
}
