import { describe, expect, test } from "vitest";

import { sortProviders } from "./sort-providers";

describe("sortProviders", () => {
  test("keeps Notiz first and Custom last", () => {
    const sorted = sortProviders([
      { id: "custom", displayName: "Custom" },
      { id: "fireworks", displayName: "Fireworks", disabled: true },
      { id: "openai", displayName: "OpenAI" },
      { id: "notiz", displayName: "Notiz" },
    ]);

    expect(sorted.map((provider) => provider.id)).toEqual([
      "notiz",
      "openai",
      "fireworks",
      "custom",
    ]);
  });
});
