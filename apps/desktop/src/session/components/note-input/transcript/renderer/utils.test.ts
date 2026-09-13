import chroma from "chroma-js";
import { describe, expect, it } from "vitest";

import {
  buildSpeakerQuotes,
  getActiveLineIndex,
  getSegmentColor,
  getSegmentColorVars,
} from "./utils";

import type { Segment, SegmentKey, SegmentWord } from "~/stt/live-segment";
import { SegmentKeyUtils } from "~/stt/live-segment";

describe("transcript renderer utils", () => {
  it("uses a brighter speaker color for dark mode", () => {
    const key: SegmentKey = {
      channel: "RemoteParty",
      speaker_index: 1,
      speaker_human_id: null,
    };

    expect(chroma(getSegmentColor(key, "dark")).luminance()).toBeGreaterThan(
      chroma(getSegmentColor(key)).luminance(),
    );
  });

  it("exposes light and dark speaker color variables", () => {
    const key: SegmentKey = {
      channel: "DirectMic",
      speaker_index: 0,
      speaker_human_id: null,
    };

    expect(getSegmentColorVars(key)).toEqual({
      "--segment-color-light": getSegmentColor(key),
      "--segment-color-dark": getSegmentColor(key, "dark"),
    });
  });

  it("finds the active transcript line without building line groups", () => {
    const words: SegmentWord[] = [
      createWord("word-1", "Hello", 100, 400),
      createWord("word-2", "world.", 400, 900),
      createWord("word-3", "Next", 1400, 1600),
      createWord("word-4", "line!", 1600, 2100),
    ];

    expect(getActiveLineIndex(words, 50, 0)).toBeNull();
    expect(getActiveLineIndex(words, 50, 149)).toBeNull();
    expect(getActiveLineIndex(words, 50, 150)).toBe(0);
    expect(getActiveLineIndex(words, 50, 950)).toBe(0);
    expect(getActiveLineIndex(words, 50, 1200)).toBeNull();
    expect(getActiveLineIndex(words, 50, 1450)).toBe(1);
    expect(getActiveLineIndex(words, 50, 2150)).toBe(1);
    expect(getActiveLineIndex(words, 50, 2200)).toBeNull();
  });
});

function createWord(
  id: string,
  text: string,
  startMs: number,
  endMs: number,
): SegmentWord {
  return {
    id,
    text,
    start_ms: startMs,
    end_ms: endMs,
    channel: "MixedCapture",
    is_final: true,
  };
}

describe("buildSpeakerQuotes", () => {
  const remote = (speaker_index: number): SegmentKey => ({
    channel: "RemoteParty",
    speaker_index,
    speaker_human_id: null,
  });
  const segment = (key: SegmentKey, text: string) =>
    ({
      id: text,
      key,
      text,
      words: [],
      start_ms: 0,
      end_ms: 0,
    }) as unknown as Segment;
  const quotesFor = (quotes: Map<string, string[]>, key: SegmentKey) =>
    quotes.get(SegmentKeyUtils.serialize(key));

  it("keeps up to two quotes per speaker, preferring longer lines", () => {
    const quotes = buildSpeakerQuotes([
      segment(remote(1), "okay"),
      segment(remote(1), "the math assignment is due friday"),
      segment(remote(2), "I will send the deck tonight"),
      segment(remote(1), "and the quiz covers chapters seven and eight"),
      segment(remote(1), "one more long line that is not needed"),
    ]);

    expect(quotesFor(quotes, remote(1))).toEqual([
      "the math assignment is due friday",
      "and the quiz covers chapters seven and eight",
    ]);
    expect(quotesFor(quotes, remote(2))).toEqual([
      "I will send the deck tonight",
    ]);
  });

  it("falls back to short lines when a speaker has nothing longer", () => {
    const quotes = buildSpeakerQuotes([
      segment(remote(3), "yes"),
      segment(remote(3), "sure"),
    ]);

    expect(quotesFor(quotes, remote(3))).toEqual(["yes", "sure"]);
  });

  it("skips blank and duplicate lines and truncates long ones", () => {
    const long = "word ".repeat(40).trim();
    const quotes = buildSpeakerQuotes(
      [
        segment(remote(4), "   "),
        segment(remote(4), "same thing again"),
        segment(remote(4), "same   thing again"),
        segment(remote(4), long),
      ],
      2,
      20,
    );
    const result = quotesFor(quotes, remote(4)) ?? [];

    expect(result[0]).toBe("same thing again");
    expect(result[1]?.endsWith("…")).toBe(true);
    expect(result[1]?.length).toBeLessThanOrEqual(21);
  });
});
