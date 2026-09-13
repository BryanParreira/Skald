export function normalizeKeywordList(words: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const word of words) {
    const normalized = word.trim().replace(/\s+/g, " ");
    const key = normalized.toLocaleLowerCase();
    if (normalized.length < 2 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

export function parseDictionaryTermsText(value: string): string[] {
  return normalizeKeywordList(
    value
      .split(/[\n,]/)
      .map((term) => term.trim())
      .filter(Boolean),
  );
}

export function formatDictionaryTerms(terms: string[]): string {
  return normalizeKeywordList(terms).join("\n");
}

const MAX_LEARNED_TERM_WORDS = 4;
const MAX_LEARNED_TERM_LENGTH = 40;

// A correction can replace a whole phrase, but only short, name-like
// replacements are worth biasing speech recognition toward.
export function isLearnableTerm(term: string): boolean {
  const normalized = term.trim().replace(/\s+/g, " ");
  if (
    normalized.length < 2 ||
    normalized.length > MAX_LEARNED_TERM_LENGTH ||
    normalized.split(" ").length > MAX_LEARNED_TERM_WORDS
  ) {
    return false;
  }
  return /\p{L}/u.test(normalized);
}

export function mergeLearnedTerm(
  storedTerms: unknown,
  term: string,
): string | null {
  if (!isLearnableTerm(term)) {
    return null;
  }

  const existing = parseStoredTerms(storedTerms);
  const key = term.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  if (existing.some((item) => item.toLocaleLowerCase() === key)) {
    return null;
  }

  return JSON.stringify(normalizeKeywordList([...existing, term]));
}

function parseStoredTerms(value: unknown): string[] {
  if (typeof value !== "string" || !value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
