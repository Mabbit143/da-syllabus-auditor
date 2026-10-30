"use client";

import { useEffect, useRef, useState } from "react";
import Report from "@/components/Report";
import TermView, { type Course } from "@/components/TermView";
import { useSchool, useUserId } from "@/components/Nav";
import { deleteAudit, loadAudits, loadSchoolPolicies, recordGaps, saveAudit, saveSchoolPolicies } from "@/lib/cloud";
import { extractPages } from "@/lib/extract";
import { mergePieces } from "@/lib/merge";
import { ocrPages } from "@/lib/ocr";
import type { PolicyCheck } from "@/lib/policy/types";
import type { CourseContext } from "@/lib/policy/contents-types";
import type { AuditReport, Page } from "@/lib/types";

type StoredCourse = Course & { pages: Page[] };
type Status = { step: "idle" } | { step: "working"; message: string } | { step: "error"; message: string };
type PieceDraft = { label: string; kind: "file"; file: File } | { label: string; kind: "text"; text: string };

const STORE_KEY = "da-syllabus-auditor.courses.v1";

function load(): StoredCourse[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredCourse[]) : [];
  } catch {
    return [];
  }
}

function save(courses: StoredCourse[]) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(courses));
  } catch {
    // Storage may be full or blocked; the term view still works for this session.
  }
}

export default function AuditorHome({ disclosure }: { disclosure: string }) {
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ step: "idle" });

  const userId = useUserId();
  const [school, saveSchool] = useSchool();
  const [schoolDraft, setSchoolDraft] = useState("");
  const [policy, setPolicy] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  const [contentsState, setContentsState] = useState<Record<string, { busy: boolean; error: string }>>({});
  const contentsRequests = useRef<Record<string, number>>({});

  useEffect(() => {
    setCourses(load());
  }, []);

  // Signed in: the account is the source of truth. If it is empty, upload what is on this device.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const remote = await loadAudits();
      if (remote === null) return;
      if (remote.length > 0) {
        setCourses(remote);
        save(remote);
      } else {
        for (const c of load()) await saveAudit(c);
      }
    })();
  }, [userId]);

  function update(next: StoredCourse[]) {
    setCourses(next);
    save(next);
  }

  /** Compares one syllabus with its school's published policies and files the differences. */
  async function runPolicyCheck(id: string, pages: Page[]) {
    const checkSchool = school ?? courses.find((c) => c.id === id)?.report.policyCheck?.school;
    if (!checkSchool) return;
    setPolicy({ busy: true, error: "" });
    try {
      const saved = await loadSchoolPolicies(checkSchool);
      const res = await fetch("/api/policy-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school: checkSchool, pages, saved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The policy check failed.");
      const check: PolicyCheck = { school: checkSchool, checkedAt: new Date().toISOString(), items: data.items, comparisonStatus: "complete" };
      let done: StoredCourse | undefined;
      setCourses((prev) => {
        const next = prev.map((c) => (c.id === id ? (done = { ...c, report: { ...c.report, policyCheck: { ...check, requiredContents: c.report.policyCheck?.requiredContents } } }) : c));
        save(next);
        return next;
      });
      if (done) void saveAudit({ id, report: done.report, pages });
      if (data.newPolicies) void saveSchoolPolicies(checkSchool, data.policies);
      void recordGaps(checkSchool, pages, data.items);
      setPolicy({ busy: false, error: "" });
    } catch (err) {
      console.error("[policy] failed:", err);
      setPolicy({ busy: false, error: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function runRequiredContents(course: StoredCourse, context: CourseContext) {
    const checkSchool = school ?? course.report.policyCheck?.school;
    if (!checkSchool) return;
    const id = course.id;
    const sequence = (contentsRequests.current[id] ?? 0) + 1;
    contentsRequests.current[id] = sequence;
    setContentsState((prev) => ({ ...prev, [id]: { busy: true, error: "" } }));
    try {
      const res = await fetch("/api/policy-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school: checkSchool, pages: course.pages, pageCount: course.report.pageCount, coverage: course.report.coverage, requiredContentsContext: context, contentsOnly: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.requiredContents) throw new Error(data?.error?.message ?? "Required contents could not be checked. Please retry.");
      if (contentsRequests.current[id] !== sequence) return;
      setCourses((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          const previous = c.report.policyCheck;
          const updated = { ...c, report: { ...c.report, policyCheck: { school: checkSchool, checkedAt: previous?.checkedAt ?? new Date().toISOString(), items: previous?.items ?? [], comparisonStatus: previous?.comparisonStatus ?? (previous ? "complete" as const : "not_run" as const), requiredContents: data.requiredContents } } };
          void saveAudit(updated);
          return updated;
        });
        save(next);
        return next;
      });
      setContentsState((prev) => ({ ...prev, [id]: { busy: false, error: "" } }));
    } catch (err) {
      if (contentsRequests.current[id] !== sequence) return;
      console.error("[policy/contents] request failed");
      setContentsState((prev) => ({ ...prev, [id]: { busy: false, error: err instanceof Error ? err.message : "Required contents could not be checked. Please retry." } }));
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus({ step: "error", message: "Please choose a PDF file." });
      return;
    }
    try {
      setStatus({ step: "working", message: `Reading ${file.name}…` });
      const extracted = await extractPages(file);
      const pageCount = extracted.pageCount;
      let pages = extracted.pages;
      let scanned = false;
      if (pages.reduce((n, p) => n + p.text.length, 0) < 200) {
        // No selectable text: try OCR. If it is unavailable or finds nothing, fail plainly.
        try {
          setStatus({ step: "working", message: "This PDF has no selectable text. Reading its page images with OCR…" });
          pages = await ocrPages(file, (done, total) => setStatus({ step: "working", message: `Reading scanned pages with OCR: ${done} of ${total}…` }));
          scanned = true;
        } catch (err) {
          console.error("[ocr] failed:", err instanceof Error ? err.message : err);
        }
        if (!scanned || pages.reduce((n, p) => n + p.text.length, 0) < 200) {
          setStatus({ step: "error", message: "Could not read text from this file." });
          return;
        }
      }
      setStatus({ step: "working", message: `Auditing ${pageCount} pages. This can take a minute or two…` });
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), fileName: file.name, pageCount, pages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The audit failed.");
      const report: AuditReport = scanned ? { ...data.report, textSource: "ocr" } : data.report;
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      update([...courses, { id, report, pages, createdAt }]);
      void saveAudit({ id, report, pages, createdAt });
      setOpenId(id);
      setStatus({ step: "idle" });
      void runPolicyCheck(id, pages);
    } catch (err) {
      console.error("[audit] failed:", err);
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const [multiMode, setMultiMode] = useState(false);
  const [pieces, setPieces] = useState<PieceDraft[]>([{ label: "", kind: "text", text: "" }]);

  function updatePiece(i: number, next: Partial<PieceDraft>) {
    setPieces((prev) => prev.map((p, idx) => (idx === i ? ({ ...p, ...next } as PieceDraft) : p)));
  }

  async function onPieces() {
    const usable = pieces.filter((p) => p.label.trim() && (p.kind === "text" ? p.text.trim() : p.file));
    if (usable.length === 0) {
      setStatus({ step: "error", message: "Add at least one labeled piece with content." });
      return;
    }
    try {
      setStatus({ step: "working", message: "Reading each piece…" });
      const parts = await Promise.all(usable.map(async (p) => {
        if (p.kind === "text") return { label: p.label.trim(), pages: [{ pageNumber: 1, text: p.text.trim() }] };
        const extracted = await extractPages(p.file);
        if (extracted.pages.reduce((n, pg) => n + pg.text.length, 0) < 20) {
          throw new Error(`"${p.label}" has no selectable text. Paste its text instead, or use the single-PDF upload above for a scanned file.`);
        }
        return { label: p.label.trim(), pages: extracted.pages };
      }));
      const merged = mergePieces(parts);
      setStatus({ step: "working", message: `Auditing ${merged.pageCount} combined pages from ${parts.length} pieces. This can take a minute or two…` });
      const fileName = `Combined syllabus (${parts.length} pieces)`;
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), fileName, pageCount: merged.pageCount, pages: merged.pages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The audit failed.");
      const report: AuditReport = data.report;
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      update([...courses, { id, report, pages: merged.pages, createdAt }]);
      void saveAudit({ id, report, pages: merged.pages, createdAt });
      setOpenId(id);
      setPieces([{ label: "", kind: "text", text: "" }]);
      setMultiMode(false);
      setStatus({ step: "idle" });
      void runPolicyCheck(id, merged.pages);
    } catch (err) {
      console.error("[audit] combined pieces failed:", err);
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const open = courses.find((c) => c.id === openId);

  return (
    <main>
      <h1 className="noprint">DA Syllabus Auditor</h1>
      <section className="noprint">
        <p>Upload a syllabus PDF to see how it treats students, with quotes you can check yourself. The PDF stays in your browser; only its text is sent for analysis. If a PDF is a scan with no selectable text, its page images are sent to Modal to be read by OCR; they are not stored. {disclosure} Audits are saved in this browser, and in your account if you are signed in. Add several syllabi to compare your term. If you are signed in, quotes where a syllabus differs from your school&rsquo;s published policy, and the instructor&rsquo;s name, are also recorded in our system, not linked to your account.</p>
        {userId && school === null && (
          <form onSubmit={(e) => { e.preventDefault(); if (schoolDraft.trim().length >= 3) void saveSchool(schoolDraft); }}>
            <label>Which school are you at? <input type="text" value={schoolDraft} onChange={(e) => setSchoolDraft(e.target.value)} placeholder="University of Oregon" required minLength={3} /></label>{" "}
            <button type="submit">Save school</button>
          </form>
        )}
        <input type="file" aria-label="Upload syllabus PDF" accept="application/pdf" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} disabled={status.step === "working"} />
        <p>
          <button type="button" className="link" onClick={() => setMultiMode(!multiMode)} aria-expanded={multiMode}>
            {multiMode ? "Hide" : "Syllabus scattered across several Canvas pages? Combine pieces instead"}
          </button>
        </p>
        {multiMode && (
          <div className="pieces">
            <p className="muted">Add one piece per Canvas page or file. Each piece is labeled by what you call it, so the report can disclose how the syllabus was assembled.</p>
            {pieces.map((p, i) => (
              <div key={i} className="piece">
                <label>Label (e.g. &ldquo;Grading policy page&rdquo;)<input type="text" value={p.label} onChange={(e) => updatePiece(i, { label: e.target.value })} disabled={status.step === "working"} /></label>
                <label>
                  <select value={p.kind} onChange={(e) => updatePiece(i, e.target.value === "file" ? { kind: "file", file: (p as { file?: File }).file ?? new File([], "") } : { kind: "text", text: (p as { text?: string }).text ?? "" })} disabled={status.step === "working"}>
                    <option value="text">Paste text</option>
                    <option value="file">Upload PDF</option>
                  </select>
                </label>
                {p.kind === "text" ? (
                  <textarea aria-label={`Text for piece ${i + 1}`} value={p.text} onChange={(e) => updatePiece(i, { text: e.target.value })} disabled={status.step === "working"} rows={4} />
                ) : (
                  <input type="file" aria-label={`PDF for piece ${i + 1}`} accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) updatePiece(i, { file: f }); }} disabled={status.step === "working"} />
                )}
                {pieces.length > 1 && (
                  <button type="button" className="link" onClick={() => setPieces((prev) => prev.filter((_, idx) => idx !== i))} disabled={status.step === "working"}>Remove piece</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setPieces((prev) => [...prev, { label: "", kind: "text", text: "" }])} disabled={status.step === "working"}>Add another piece</button>{" "}
            <button type="button" onClick={() => void onPieces()} disabled={status.step === "working"}>Audit combined syllabus</button>
          </div>
        )}
      </section>
      {status.step === "working" && <p role="status">{status.message}</p>}
      {status.step === "error" && <p role="alert" className="warn">{status.message}</p>}

      {open ? (
        <>
          <button type="button" className="noprint" onClick={() => setOpenId(null)}>Back to term view</button>
          <Report key={open.id} report={open.report} pages={open.pages} policy={{ school: school ?? null, busy: policy.busy, error: policy.error, onRun: () => void runPolicyCheck(open.id, open.pages), contentsBusy: contentsState[open.id]?.busy, contentsError: contentsState[open.id]?.error, onRunContents: (context) => void runRequiredContents(open, context) }} />
        </>
      ) : (
        <TermView
          courses={courses}
          onOpen={setOpenId}
          onRemove={(id) => {
            update(courses.filter((c) => c.id !== id));
            void deleteAudit(id);
          }}
        />
      )}
    </main>
  );
}

