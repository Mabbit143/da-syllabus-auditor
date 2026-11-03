import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { researchRequest } from "@/lib/research/client";
import type { ResearchOverview, ScanPreview } from "@/lib/research/types";

export default function ScanReview({ scans, saved }: { scans: NonNullable<ResearchOverview["scans"]>; saved: () => void }) {
  const [scanId, setScanId] = useState(scans.sources[0]?.id || 0);
  const [page, setPage] = useState(scans.sources[0]?.needs_review_pages[0] || 1);
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [quote, setQuote] = useState("");
  const [region, setRegion] = useState([0, 0, 0, 0]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const effectiveScanId = scans.sources.some((item) => item.id === scanId) ? scanId : scans.sources[0]?.id || 0;
  const source = scans.sources.find((item) => item.id === effectiveScanId);
  const regionFits = preview && region.every(Number.isSafeInteger) && region[0] >= 0 && region[1] >= 0 && region[2] > 0 && region[3] > 0 && region[0] + region[2] <= preview.width && region[1] + region[3] <= preview.height;
  async function load() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setPreview(null); setConfirmed(false); setQuote(""); setMessage(""); setError("");
    try {
      const result = await researchRequest<ScanPreview>(`/api/research?scan=${effectiveScanId}&physical_page=${page}`, { signal: request.signal });
      if (!request.signal.aborted) { setPreview(result); setRegion([0, 0, result.width, result.height]); }
    } catch (error) { if (!request.signal.aborted) setError(error instanceof Error ? error.message : "The source image could not be loaded."); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  async function approve(event: React.FormEvent) {
    event.preventDefault();
    if (!preview) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await researchRequest("/api/research", { method: "POST", body: JSON.stringify({ action: "scan_passage", scan_id: preview.scan_id, page: preview.page, pdf_sha256: preview.pdf_sha256, image_sha256: preview.image_sha256, quote, region, confirmed }) });
      setConfirmed(false); setQuote(""); setMessage("Reviewed passage saved and queued for analysis. Only this passage was admitted."); saved();
    } catch (error) { setError(error instanceof Error ? error.message : "The reviewed passage could not be saved."); }
    finally { setBusy(false); }
  }
  return <details>
    <summary>Scanned and sparse-text PDFs ({scans.total_sources})</summary>
    <p>Scans stay outside research analysis until the owner compares an exact passage with its source image. The worker never approves its own OCR. Saving one passage leaves the rest of the document unreviewed.</p>
    {scans.sources.length === 0 ? <p>No scans awaiting source review.</p> : <>
      <label>Saved scan <select disabled={busy} value={effectiveScanId} onChange={(event) => {
        const id = Number(event.target.value); setScanId(id); setPage(scans.sources.find((item) => item.id === id)?.needs_review_pages[0] || 1); setPreview(null); setConfirmed(false);
      }}>{scans.sources.map((item) => <option key={item.id} value={item.id}>{item.url} · {item.approved_passages} approved passage(s)</option>)}</select></label>
      {source && <p>{source.page_count} physical page(s). Sparse or unreadable native text on pages: {source.needs_review_pages.join(", ") || "not specified"}.</p>}
      <label>Physical PDF page <input type="number" min={1} max={source?.page_count || 500} value={page} disabled={busy} onChange={(event) => { setPage(Number(event.target.value)); setPreview(null); setConfirmed(false); }} /></label>
      <button disabled={busy || !source || !page} onClick={load}>Load source page</button>
      {preview && preview.scan_id === effectiveScanId && <section aria-label="Scan source review">
        <p><a href={`${preview.url}#page=${preview.page}`} target="_blank" rel="noopener noreferrer">Original PDF, page {preview.page}</a> · {preview.method}</p>
        <Image src={preview.image_data_url} alt={`Saved source PDF page ${preview.page}`} width={preview.width} height={preview.height} unoptimized style={{ width: "100%", height: "auto" }} />
        <form onSubmit={approve}>
          <label>Exact passage checked against the image <textarea required minLength={40} maxLength={500} value={quote} onChange={(event) => { setQuote(event.target.value); setConfirmed(false); }} /></label>
          <p>Image region in original pixels. The default covers the full page; narrow it to the passage when possible.</p>
          {(["X", "Y", "Width", "Height"] as const).map((label, index) => <label key={label}>Review region {label}<input type="number" min={index < 2 ? 0 : 1} required value={region[index]} onChange={(event) => { setRegion(region.map((value, position) => position === index ? Number(event.target.value) : value)); setConfirmed(false); }} /></label>)}
          <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I compared this exact passage against the source image, including qualifications and exceptions.</label>
          <button disabled={busy || !confirmed || !regionFits || quote.trim().length < 40}>Save reviewed passage</button>
        </form>
        {preview.receipts.length > 0 && <details><summary>Earlier passage receipts for this page</summary><ul>{preview.receipts.map((receipt) => <li key={receipt.id}>{receipt.quote} · reviewed {new Date(receipt.reviewed_at * 1000).toLocaleString()}</li>)}</ul></details>}
      </section>}
      <p>Showing up to {scans.limit} recent scan sources. Reviewed fragments do not establish full-page or full-document coverage.</p>
    </>}
    {busy && <p role="status">Preparing source review…</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </details>;
}
