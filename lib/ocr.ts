import { openPdf } from "./extract";
import type { Page } from "./types";

const MAX_PAGES = 20;
const BATCH = 3;
const WIDTH = 1600;

/** Browser-only. For a PDF with no selectable text: renders each page to an image and has it read by OCR. */
export async function ocrPages(file: File, onProgress: (done: number, total: number) => void): Promise<Page[]> {
  const doc = await openPdf(file);
  if (doc.numPages > MAX_PAGES) throw new Error(`Scanned files are limited to ${MAX_PAGES} pages.`);
  const pages: Page[] = [];
  for (let first = 1; first <= doc.numPages; first += BATCH) {
    const images: string[] = [];
    const numbers: number[] = [];
    for (let n = first; n < first + BATCH && n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, WIDTH / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
      numbers.push(n);
    }
    const res = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data?.pages)) throw new Error(data?.error?.message ?? "The scanned pages could not be read.");
    data.pages.forEach((text: string, i: number) => pages.push({ pageNumber: numbers[i], text: String(text).trim() }));
    onProgress(pages.length, doc.numPages);
  }
  return pages;
}
