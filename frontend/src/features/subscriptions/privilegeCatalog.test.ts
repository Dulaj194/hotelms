import { describe, expect, it } from "vitest";

import {
  buildEnabledModules,
  buildPrivilegeSummaries,
} from "@/features/subscriptions/privilegeCatalog";

describe("privilegeCatalog", () => {
  it("maps package privileges into ordered module access", () => {
    const modules = buildEnabledModules(["HOUSEKEEPING", "QR_MENU"]);

    expect(modules.map((module) => module.key)).toEqual([
      "housekeeping",
      "orders",
      "reports",
      "billing",
    ]);
  });

  it("builds a fallback summary for unknown privileges", () => {
    const summaries = buildPrivilegeSummaries(["custom_feature"]);

    expect(summaries).toEqual([
      {
        code: "CUSTOM_FEATURE",
        label: "Custom Feature",
        description: "Custom privilege configured for this package.",
        modules: [],
      },
    ]);
  });
});
