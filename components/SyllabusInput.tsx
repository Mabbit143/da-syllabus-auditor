"use client";

import { useEffect, useRef, useState } from "react";
import { extractPages, type Extracted } from "@/lib/extract";
import { ocrPages } from "@/lib/ocr";
import { mergePieces } from "@/lib/merge";
import { normalizeCourseCode } from "@/lib/departments";
import PrivacyDisclosure from "@/components/PrivacyDisclosure";
import { inferTermId } from "@/lib/term";
import type { Page } from "@/lib/types";

export interface AuditInput { fileName: string; pageCount: number; pages: Page[]; courseCode?: string; scanned?: boolean; termId?: string | null }
type Source = Extracted & { file: File; scanned?: boolean; needsOcr?: boolean };
type Piece = { id: number; label: string; kind: "text" | "file"; text: string; source?: Source; reading?: boolean; error?: string };
const blankPiece = (id: number): Piece => ({ id, label: "", kind: "text", text: "" });
const hasText = (pages: Page[], minimum: number) => pages.reduce((n, p) => n + p.text.length, 0) >= minimum;

export default function SyllabusInput({ disclosure, signedIn, onAudit }: {
  disclosure: string; signedIn: boolean; onAudit: (input: AuditInput, signal: AbortSignal) => Promise<void>;
}) {
  const [multi, setMulti] = useState(false);
  const [source, setSource] = useState<Source>();
  const [pieces, setPieces] = useState<Piece[]>([blankPiece(0)]);
  const [courseCode, setCourseCode] = useState("");
  const currentYear = new Date().getFullYear();
  const [termSeason, setTermSeason] = useState<"winter"|"spring"|"summer"|"fall"|"unknown">("unknown");
  const [termYear, setTermYear] = useState<number>(currentYear);
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const selection = useRef(0);
  const pieceSelections = useRef<Record<number, number>>({});
  const nextPiece = useRef(1);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { selection.current++; request.current?.abort(); }, []);

  async function choose(file: File | undefined, pieceId?: number) {
    if (!file) return;
    const sequence = pieceId === undefined ? ++selection.current : (pieceSelections.current[pieceId] = (pieceSelections.current[pieceId] ?? 0) + 1);
    const current = () => pieceId === undefined ? selection.current === sequence : pieceSelections.current[pieceId] === sequence;
    setError("");
    if (pieceId === undefined) { setSource(undefined); setReading(true); }
    else setPieces((prev) => prev.map((p) => p.id === pieceId ? { ...p, source: undefined, reading: true, error: undefined } : p));
    try {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Please choose a PDF file.");
      const extracted = await extractPages(file);
      if (!current()) return;
      const next = { ...extracted, file, needsOcr: !hasText(extracted.pages, pieceId === undefined ? 200 : 20) };
      if (pieceId === undefined) {
        setSource(next);
        if (termSeason === "unknown") {
          const inferred = inferTermId({ fileName: file.name, text: next.pages.map((pg) => pg.text).join(" ") });
          if (inferred) {
            const [y, s] = inferred.split("-");
            setTermYear(Number(y));
            setTermSeason(s as "winter"|"spring"|"summer"|"fall");
          }
        }
      } else setPieces((prev) => prev.map((p) => p.id === pieceId ? { ...p, source: next } : p));
    } catch (err) {
      if (!current()) return;
      console.error("[input] PDF extraction failed:", err);
      const message = err instanceof Error && err.message === "Please choose a PDF file." ? err.message : "Could not read this PDF. Choose another file or paste its text in Combine pieces.";
      if (pieceId === undefined) setError(message);
      else setPieces((prev) => prev.map((p) => p.id === pieceId ? { ...p, error: message } : p));
    } finally {
      if (current()) {
        if (pieceId === undefined) setReading(false);
        else setPieces((prev) => prev.map((p) => p.id === pieceId ? { ...p, reading: false } : p));
      }
    }
  }

  async function readScan() {
    if (!source || busy) return;
    const sequence = selection.current;
    setBusy(true); setError(""); setStage("Reading scanned pages with OCR…");
    try {
      const pages = await ocrPages(source.file, (done, total) => {
        if (sequence === selection.current) setStage(`Reading scanned pages with OCR: ${done} of ${total}…`);
      });
      if (sequence !== selection.current) return;
      if (!hasText(pages, 200)) throw new Error("No readable text");
      setSource({ ...source, pages, scanned: true, needsOcr: false });
    } catch (err) {
      console.error("[ocr] failed:", err);
      if (sequence === selection.current) setError("Could not read this PDF. Choose another file or paste its text in Combine pieces.");
    } finally { if (sequence === selection.current) { setBusy(false); setStage(""); } }
  }

  async function audit() {
    if (busy || request.current) return;
    if (termSeason === "unknown") { setError("Please choose the term for this syllabus (e.g. Spring 2025) so due dates land on the right semester."); return; }
    setError("");
    let input: AuditInput;
    if (multi) {
      const normalized = normalizeCourseCode(courseCode);
      if (courseCode.trim() && !normalized) { setError("Enter a course code such as ANTH 341, or leave it blank."); return; }
      if (!pieces.length || pieces.some((p) => !p.label.trim() || (p.kind === "text" ? !p.text.trim() : !p.source || p.source.needsOcr))) {
        setError("Add content and a label to every piece, or remove unused pieces. Scanned pieces need pasted text; use Single PDF for OCR."); return;
      }
      const merged = mergePieces(pieces.map((p) => ({ label: p.label.trim(), pages: p.kind === "text" ? [{ pageNumber: 1, text: p.text.trim() }] : p.source!.pages })));
      const termIdM = `${termYear}-${termSeason}`;
      input = { ...merged, fileName: `${normalized ? `${normalized} — ` : ""}Combined syllabus (${pieces.length} pieces)`, ...(normalized ? { courseCode: normalized } : {}), termId: termIdM };
    } else {
      if (!source) return;
      if (source.needsOcr) { setError("Could not read this PDF. Choose another file or paste its text in Combine pieces."); return; }
      const termId = `${termYear}-${termSeason}`;
      input = { fileName: source.file.name, pages: source.pages, pageCount: source.pageCount, scanned: source.scanned, termId };
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setStage(`Auditing ${input.pageCount} page${input.pageCount === 1 ? "" : "s"}. This can take a minute or two…`);
    try { await onAudit(input, controller.signal); }
    catch (err) {
      if (!controller.signal.aborted) {
        console.error("[audit] failed:", err);
        setError(err instanceof Error ? err.message : "The audit failed. Please retry.");
      }
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); setStage(""); }
    }
  }

  function edit(id: number, change: Partial<Piece>) {
    setPieces((prev) => prev.map((p) => p.id === id ? { ...p, ...change } : p));
  }

  return <section className="syllabus-input" aria-label="Syllabus input">
    <h2>Add your syllabus</h2>
    <div className="input-modes actions">
      <button type="button" className={`chip ${!multi ? "on" : ""}`} aria-pressed={!multi} disabled={busy} onClick={() => { setMulti(false); setError(""); }}>Single PDF</button>
      <button type="button" className={`chip ${multi ? "on" : ""}`} aria-pressed={multi} disabled={busy} onClick={() => { setMulti(true); setError(""); }}>Combine pieces instead</button>
    </div>
    {!multi ? <>
      <label className="input-label">Choose a PDF<input type="file" aria-label="Upload syllabus PDF" accept="application/pdf" disabled={busy} onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} /></label>
      {reading && <p role="status">Extracting text in your browser…</p>}
    </> : <div className="pieces">
      <p className="muted">Add labeled text or PDF pieces in source order. This is not a Canvas connection. Scanned pieces need pasted text; Single PDF supports OCR.</p>
      <label>Course code (optional)<input type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="ANTH 341" disabled={busy} /></label>
      <p className="muted">Used to group this course by department. Leave blank if you do not know it.</p>
      {pieces.map((p, i) => <div className="piece" key={p.id}>
        <label>Label (e.g. &ldquo;Grading policy page&rdquo;)<input type="text" value={p.label} disabled={busy} onChange={(e) => edit(p.id, { label: e.target.value })} /></label>
        <label>Input type for piece {i + 1}<select value={p.kind} disabled={busy} onChange={(e) => edit(p.id, { kind: e.target.value as Piece["kind"] })}><option value="text">Paste text</option><option value="file">Upload PDF</option></select></label>
        {p.kind === "text" ? <textarea aria-label={`Text for piece ${i + 1}`} value={p.text} disabled={busy} rows={4} onChange={(e) => edit(p.id, { text: e.target.value })} /> : <input type="file" aria-label={`PDF for piece ${i + 1}`} accept="application/pdf" disabled={busy} onChange={(e) => { void choose(e.target.files?.[0], p.id); e.target.value = ""; }} />}
        {p.reading && <p role="status">Extracting this piece…</p>}
        {p.error && <p role="alert" className="warn">{p.error}</p>}
        {pieces.length > 1 && <button type="button" className="link" disabled={busy} onClick={() => { pieceSelections.current[p.id] = (pieceSelections.current[p.id] ?? 0) + 1; setPieces((prev) => prev.filter((piece) => piece.id !== p.id)); }}>Remove piece</button>}
      </div>)}
      <button type="button" className="secondary" disabled={busy} onClick={() => setPieces((prev) => [...prev, blankPiece(nextPiece.current++)])}>Add another piece</button>
    </div>}
    {(source && !multi || multi) && <section className="source-review" aria-label="Source review">
      <h3>Review your sources</h3>
      {!multi && source ? <>
        <p><strong>{source.file.name}</strong> · {source.pageCount} page{source.pageCount === 1 ? "" : "s"} · {source.needsOcr ? "OCR needed" : source.scanned ? "OCR text — check for reading errors" : "Text extracted locally"}</p>
        {source.needsOcr ? <p className="warn">No selectable text was found. Read scanned pages first, then review the extracted text before Audit syllabus.</p> : <details><summary>Review extracted text</summary>{source.pages.map((p) => <div key={p.pageNumber}><p className="where">Page {p.pageNumber}</p><pre className="context">{p.text || "No text on this page."}</pre></div>)}</details>}
        <button className="link" type="button" disabled={busy} onClick={() => { selection.current++; setSource(undefined); setError(""); }}>Remove PDF</button>
      </> : <ol>{pieces.map((p, i) => <li key={p.id}>{p.label || `Piece ${i + 1} — label needed`} · {p.kind === "text" ? `Text · ${p.text.trim() ? "1 page" : "add text"}` : p.source ? `${p.source.file.name} · ${p.source.pageCount} pages${p.source.needsOcr ? " · no selectable text; paste text instead" : " · locally extracted"}` : "PDF not ready"}</li>)}</ol>}
    </section>}
    <fieldset className="term-picker" aria-label="Term for this syllabus" style={{ margin: "1rem 0", border: "1px solid var(--border)", padding: "0.75rem" }}>
      <legend>Which term is this syllabus for?</legend>
      <p className="muted" style={{ marginTop: 0 }}>We need the term to place due dates on your calendar correctly. Choose the term that matches the syllabus — not today&apos;s date.</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <label>Term <select value={termSeason} onChange={(e) => setTermSeason(e.target.value as never)} disabled={busy}>
          <option value="unknown">— Select term —</option>
          <option value="winter">Winter</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="fall">Fall</option>
        </select></label>
        <label>Year <select value={termYear} onChange={(e) => setTermYear(Number(e.target.value))} disabled={busy || termSeason === "unknown"}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select></label>
        {termSeason !== "unknown" && <span className="muted">→ {termYear}-{termSeason}</span>}
      </div>
      {termSeason === "unknown" && <p className="warn" style={{ marginTop: "0.5rem" }}>Pick a term before auditing — dates will be estimated from week numbers in that term.</p>}
    </fieldset>
    <PrivacyDisclosure disclosure={disclosure} signedIn={signedIn} />
    <div className="actions">
      {!multi && source?.needsOcr ? <>
        <button type="button" disabled={busy || reading} onClick={() => void readScan()}>Read scanned pages</button>
        <button type="button" disabled={busy || reading} onClick={() => void audit()}>Audit syllabus</button>
      </> : <button type="button" disabled={busy || reading || (multi ? pieces.some((p) => p.reading) : !source)} onClick={() => void audit()}>{multi ? "Audit combined syllabus" : "Audit syllabus"}</button>}
      {busy && <button type="button" className="secondary" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); setStage(""); }}>Cancel audit</button>}
    </div>
    {stage && <p role="status">{stage}</p>}
    {error && <p role="alert" className="warn">{error}</p>}
  </section>;
}
