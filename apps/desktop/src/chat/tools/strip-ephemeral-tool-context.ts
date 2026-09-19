import { CONTEXT_TEXT_FIELD } from "./context-text";

import type { SkaldUIMessage } from "~/chat/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function stripEphemeralToolContext(
  parts: SkaldUIMessage["parts"],
): SkaldUIMessage["parts"] {
  let changed = false;
  const sanitized = parts.map((part) => {
    const record = isRecord(part) ? (part as Record<string, unknown>) : null;
    const output = isRecord(record?.["output"]) ? record["output"] : null;

    if (
      !record ||
      typeof record["type"] !== "string" ||
      !record["type"].startsWith("tool-") ||
      record["state"] !== "output-available" ||
      !output ||
      !(CONTEXT_TEXT_FIELD in output)
    ) {
      return part;
    }

    changed = true;
    const { contextText: _contextText, ...restOutput } = output;
    return {
      ...record,
      output: restOutput,
    };
  });

  return changed ? (sanitized as SkaldUIMessage["parts"]) : parts;
}
