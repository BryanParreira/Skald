import { describe, expect, it } from "vitest";

import { DICTATION_HOTKEY_IDS, hotkeyFor } from "./hotkey";

describe("hotkeyFor", () => {
  it("maps each choice to a modifier-only hotkey", () => {
    expect(hotkeyFor("fn")).toEqual({ key: null, modifiers: ["fn"] });
    expect(hotkeyFor("option")).toEqual({ key: null, modifiers: ["option"] });
    expect(hotkeyFor("control_option")).toEqual({
      key: null,
      modifiers: ["control", "option"],
    });
  });

  it("falls back to Fn for missing or unknown values", () => {
    expect(hotkeyFor(undefined)).toEqual({ key: null, modifiers: ["fn"] });
    expect(hotkeyFor("something-else")).toEqual({
      key: null,
      modifiers: ["fn"],
    });
  });

  it("covers every offered choice", () => {
    for (const id of DICTATION_HOTKEY_IDS) {
      expect(hotkeyFor(id).key).toBeNull();
    }
  });
});
