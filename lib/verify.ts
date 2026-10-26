import type { Page } from "./types";

export interface QuoteMatch {
  page: number;
  start: number;
  end: number;
  text: string;
}

// Collapse whitespace runs for matching only; map keeps original indexes.
function normalize(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let inSpace = false;
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) {
      if (!inSpace && norm.length > 0) {
        norm += " ";
        map.push(i);
      }
      inSpace = true;
    } else {
      norm += text[i];
      map.push(i);
      inSpace = false;
    }
  }
  return { norm, map };
}

export const MIN_QUOTE = 12;
export const MAX_QUOTE = 500;

/**
 * Verifies a model-supplied quote is an exact substring of the claimed page,
 * ignoring only whitespace differences. Returns the original source text and
 * span, or null if missing, ambiguous, or out of bounds.
 */
export function verifyQuote(pages: Page[], pageNumber: number, quote: string): QuoteMatch | null {
  const page = pages.find((p) => p.pageNumber === pageNumber);
  if (!page || typeof quote !== "string") return null;
  const q = normalize(quote.trim()).norm;
  if (q.length < MIN_QUOTE || q.length > MAX_QUOTE) return null;

  const { norm, map } = normalize(page.text);
  const first = norm.indexOf(q);
  if (first === -1) return null;
  if (norm.indexOf(q, first + 1) !== -1) return null; // ambiguous on this page

  const start = map[first];
  const end = map[first + q.length - 1] + 1;
  return { page: pageNumber, start, end, text: page.text.slice(start, end) };
}
