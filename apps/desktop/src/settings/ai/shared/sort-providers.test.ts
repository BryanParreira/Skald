import { describe, expect, test } from "vitest";

import { sortProviders } from "./sort-providers";

describe("sortProviders", () => {
  test("keeps Skald first and Custom last", () => {
    const sorted = sortProviders([
      { id: "custom", displayName: "Custom" },
      { id: "fireworks", displayName: "Fireworks", disabled: true },
      { id: "openai", displayName: "OpenAI" },
      { id: "skald", displayName: "Skald" },
    ]);

    expect(sorted.map((provider) => provider.id)).toEqual([
      "skald",
      "openai",
      "fireworks",
      "custom",
    ]);
  });
});
