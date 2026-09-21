import type { HotKey } from "@notiz/plugin-shortcut";

export const DICTATION_HOTKEY_IDS = ["fn", "option", "control_option"] as const;

export type DictationHotkeyId = (typeof DICTATION_HOTKEY_IDS)[number];

export function hotkeyFor(id: string | undefined): HotKey {
  switch (id) {
    case "option":
      return { key: null, modifiers: ["option"] };
    case "control_option":
      return { key: null, modifiers: ["control", "option"] };
    default:
      return { key: null, modifiers: ["fn"] };
  }
}
