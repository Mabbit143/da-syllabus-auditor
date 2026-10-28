import type { Page } from "./types";

export interface Extracted {
  pageCount: number;
  pages: Page[];
}

export async function openPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

/** Browser-only: reads text per page. The PDF never leaves the browser. */
export async function extractPages(file: File): Promise<Extracted> {
  const doc = await openPdf(file);
  const pages: Page[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push({ pageNumber: n, text: text.trim() });
  }
  return { pageCount: doc.numPages, pages };
}
