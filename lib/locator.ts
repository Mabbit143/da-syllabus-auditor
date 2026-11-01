import type { Page } from "./types";

const ownNumber = (n: unknown): number | null => (typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null);

/**
 * Where a cited page sits, in words a reader can follow back to the source.
 * - Ordinary page: "page 3".
 * - Page of a combined syllabus: "Grading policy page, page 1 (combined page 3)".
 * - Combined page saved before the page within its piece was recorded: "Grading policy page, combined page 3".
 *   The page within the piece is never guessed from label grouping (labels can repeat).
 * - Single-piece document whose numbering matches: "Canvas syllabus, page 2".
 */
export function pageLocator(pages: readonly Page[] | undefined, pageNumber: number, opts: { capitalize?: boolean } = {}): string {
  const plain = `${opts.capitalize ? "Page" : "page"} ${pageNumber}`;
  const page = pages?.find((p) => p.pageNumber === pageNumber);
  const label = typeof page?.source === "string" ? page.source.trim() : "";
  if (!page || !label) return plain;
  const own = ownNumber(page.sourcePageNumber);
  if (own === null) return `${label}, combined page ${pageNumber}`;
  const labels = new Set((pages ?? []).map((p) => p.source?.trim()));
  const sameNumbering = labels.size === 1 && (pages ?? []).every((p) => ownNumber(p.sourcePageNumber) === p.pageNumber);
  return sameNumbering ? `${label}, page ${own}` : `${label}, page ${own} (combined page ${pageNumber})`;
}
