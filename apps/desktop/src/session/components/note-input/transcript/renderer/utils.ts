import chroma from "chroma-js";
import { type CSSProperties, useMemo } from "react";

import type { Segment, SegmentKey, SegmentWord } from "~/stt/live-segment";
import { SegmentKeyUtils } from "~/stt/live-segment";

export type HighlightSegment = { text: string; isMatch: boolean };

export type SentenceLine = {
  words: SegmentWord[];
  startMs: number;
  endMs: number;
};

type SegmentColorVars = CSSProperties & {
  "--segment-color-light": string;
  "--segment-color-dark": string;
};

export function groupWordsIntoLines(words: SegmentWord[]): SentenceLine[] {
  if (words.length === 0) return [];

  const lines: SentenceLine[] = [];
  let currentLine: SegmentWord[] = [];

  for (const word of words) {
    currentLine.push(word);
    const text = word.text.trim();
    if (text.endsWith(".") || text.endsWith("?") || text.endsWith("!")) {
      lines.push({
        words: currentLine,
        startMs: currentLine[0]!.start_ms,
        endMs: currentLine[currentLine.length - 1]!.end_ms,
      });
      currentLine = [];
    }
  }

  if (currentLine.length > 0) {
    lines.push({
      words: currentLine,
      startMs: currentLine[0]!.start_ms,
      endMs: currentLine[currentLine.length - 1]!.end_ms,
    });
  }

  return lines;
}

export function getActiveLineIndex(
  words: SegmentWord[],
  offsetMs: number,
  currentMs: number,
): number | null {
  if (currentMs <= 0 || words.length === 0) return null;

  let lineIndex = 0;
  let lineStartMs = words[0]!.start_ms;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const text = word.text.trim();
    const closesLine =
      text.endsWith(".") ||
      text.endsWith("?") ||
      text.endsWith("!") ||
      index === words.length - 1;

    if (!closesLine) {
      continue;
    }

    const start = offsetMs + lineStartMs;
    const end = offsetMs + word.end_ms;
    if (currentMs >= start && currentMs <= end) {
      return lineIndex;
    }

    lineIndex += 1;
    lineStartMs = words[index + 1]?.start_ms ?? lineStartMs;
  }

  return null;
}

export function getSegmentColor(
  key: SegmentKey,
  mode: "light" | "dark" = "light",
): string {
  const speakerIndex = key.speaker_index ?? 0;

  const channelPalettes = [
    [10, 25, 0, 340, 15, 350],
    [285, 305, 270, 295, 315, 280],
  ];

  const paletteIndex = key.channel === "RemoteParty" ? 1 : 0;
  const hues = channelPalettes[paletteIndex]!;
  const hue = hues[speakerIndex % hues.length]!;

  return chroma.oklch(mode === "dark" ? 0.72 : 0.55, 0.15, hue).hex();
}

export function getSegmentColorVars(key: SegmentKey): SegmentColorVars {
  return {
    "--segment-color-light": getSegmentColor(key),
    "--segment-color-dark": getSegmentColor(key, "dark"),
  };
}

export function useSegmentColor(key: SegmentKey): string {
  return useMemo(() => getSegmentColor(key), [key]);
}

export function useSegmentColorVars(key: SegmentKey): SegmentColorVars {
  return useMemo(() => getSegmentColorVars(key), [key]);
}

const MIN_QUOTE_WORDS = 3;

// A short line from each speaker makes "who is Speaker 2?" answerable at a
// glance. Prefer lines long enough to recognise someone by, but fall back to
// shorter ones so every speaker still gets a sample.
export function buildSpeakerQuotes(
  segments: Segment[],
  maxQuotes = 2,
  maxChars = 90,
): Map<string, string[]> {
  const candidates = new Map<string, { long: string[]; short: string[] }>();

  for (const segment of segments) {
    const text = segment.text.trim().replace(/\s+/g, " ");
    if (!text) {
      continue;
    }

    const key = SegmentKeyUtils.serialize(segment.key);
    const bucket = candidates.get(key) ?? { long: [], short: [] };
    if (!bucket.long.includes(text) && !bucket.short.includes(text)) {
      const isLong = text.split(" ").length >= MIN_QUOTE_WORDS;
      (isLong ? bucket.long : bucket.short).push(text);
    }
    candidates.set(key, bucket);
  }

  const quotes = new Map<string, string[]>();
  for (const [key, { long, short }] of candidates) {
    const picked = [...long, ...short]
      .slice(0, maxQuotes)
      .map((text) => truncateQuote(text, maxChars));
    if (picked.length > 0) {
      quotes.set(key, picked);
    }
  }

  return quotes;
}

function truncateQuote(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars).trimEnd()}…`;
}
