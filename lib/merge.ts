import type { Page } from "./types";

export interface Piece {
  label: string;
  pages: Page[];
}

export interface Merged {
  pageCount: number;
  pages: Page[];
  /** Set only when more than one piece contributed pages, so the report can disclose the scattering. */
  sources?: { label: string; pageCount: number }[];
}

/**
 * Combines several syllabus pieces (e.g. separate Canvas pages or files) into one
 * sequentially-numbered document, labeling every page by the piece it came from.
 * Empty pieces are dropped. verifyQuote matches by the renumbered sequence (pageNumber);
 * each page also keeps its own number within its piece (sourcePageNumber) so a citation
 * can say where in that piece the quote sits.
 */
export function mergePieces(pieces: Piece[]): Merged {
  const nonEmpty = pieces.filter((p) => p.pages.length > 0);
  if (nonEmpty.length === 0) throw new Error("No readable pages were found in any piece.");

  const pages: Page[] = [];
  for (const piece of nonEmpty) {
    piece.pages.forEach((page, i) => {
      const own = Number.isInteger(page.pageNumber) && page.pageNumber > 0 ? page.pageNumber : i + 1;
      pages.push({ pageNumber: pages.length + 1, text: page.text, source: piece.label, sourcePageNumber: own });
    });
  }

  const sources = nonEmpty.length > 1
    ? nonEmpty.map((p) => ({ label: p.label, pageCount: p.pages.length }))
    : undefined;

  return { pageCount: pages.length, pages, ...(sources ? { sources } : {}) };
}
