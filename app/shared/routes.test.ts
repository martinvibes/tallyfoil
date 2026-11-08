import { describe, expect, it } from "vitest";

import { type TallyLocation, locationForPath, pathForLocation } from "./routes";

describe("routes", () => {
  const locations: TallyLocation[] = [
    { view: "home" },
    { view: "vendor", vendorId: "ven_1" },
    { view: "finding", vendorId: "ven_1", findingId: "fnd_2" },
    { view: "document", documentId: "doc_3" },
    { view: "dispute", disputeId: "dsp_4" },
  ];

  it.each(locations)("round-trips %o through its path", (location) => {
    expect(locationForPath(pathForLocation(location))).toEqual(location);
  });

  it("leaves framework screens to the template", () => {
    expect(locationForPath("/chat/abc")).toBeNull();
    expect(locationForPath("/settings")).toBeNull();
  });

  it("falls back to the overview when an id is missing", () => {
    expect(pathForLocation({ view: "finding", findingId: "fnd_2" })).toBe("/home");
  });
});
