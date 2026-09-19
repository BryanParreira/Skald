import { describe, expect, it } from "vitest";

import { isLearnableTerm, mergeLearnedTerm } from "./keywords";

describe("isLearnableTerm", () => {
  it("accepts names and short product terms", () => {
    expect(isLearnableTerm("Skald")).toBe(true);
    expect(isLearnableTerm("Parakeet TDT")).toBe(true);
  });

  it("rejects text that is too short, too long, or has no letters", () => {
    expect(isLearnableTerm("")).toBe(false);
    expect(isLearnableTerm("a")).toBe(false);
    expect(isLearnableTerm("12345")).toBe(false);
    expect(isLearnableTerm("we should meet again next week")).toBe(false);
    expect(isLearnableTerm("x".repeat(41))).toBe(false);
  });
});

describe("mergeLearnedTerm", () => {
  it("adds a term to an empty dictionary", () => {
    expect(mergeLearnedTerm(undefined, "Skald")).toBe('["Skald"]');
    expect(mergeLearnedTerm("[]", "Skald")).toBe('["Skald"]');
  });

  it("appends to existing terms", () => {
    expect(mergeLearnedTerm('["Skald"]', "Parakeet TDT")).toBe(
      '["Skald","Parakeet TDT"]',
    );
  });

  it("skips terms already present, ignoring case", () => {
    expect(mergeLearnedTerm('["skald"]', "Skald")).toBeNull();
  });

  it("skips terms that are not worth learning", () => {
    expect(
      mergeLearnedTerm("[]", "this is a whole sentence of text"),
    ).toBeNull();
  });

  it("treats an unreadable stored value as empty", () => {
    expect(mergeLearnedTerm("not json", "Skald")).toBe('["Skald"]');
  });
});
