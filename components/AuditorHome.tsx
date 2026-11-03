"use client";

import { useEffect, useRef, useState } from "react";
import Report from "@/components/Report";
import TermView, { type Course } from "@/components/TermView";
import DepartmentView from "@/components/DepartmentView";
import SyllabusInput, { type AuditInput } from "@/components/SyllabusInput";
import { useSchool, useUserId } from "@/components/Nav";
import { deleteAudit, loadAudits, loadSchoolPolicies, recordGaps, saveAudit, saveSchoolPolicies } from "@/lib/cloud";
import type { PolicyCheck } from "@/lib/policy/types";
import type { CourseContext } from "@/lib/policy/contents-types";
import { inferTermId } from "@/lib/term";
import type { EvidenceRecord } from "@/lib/policy/evidence";
import type { AuditReport, Page } from "@/lib/types";

type StoredCourse = Course & { pages: Page[] };
type Status = { step: "idle" } | { step: "working"; message: string } | { step: "error"; message: string };

const STORE_KEY = "da-syllabus-auditor.courses.v1";

function load(): StoredCourse[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const courses = raw ? (JSON.parse(raw) as StoredCourse[]) : [];
    let changed = false;
    for (const c of courses) {
      if (!c.termId) {
        const text = c.pages?.map((p) => p.text).join(" ") ?? "";
        const inferred = inferTermId({ fileName: c.report.fileName, text });
        if (inferred) { c.termId = inferred; changed = true; }
      }
    }
    if (changed) {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(courses)); } catch {}
    }
    return courses;
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

export default function AuditorHome({ disclosure, departmentEvidence }: { disclosure: string; departmentEvidence: EvidenceRecord[] }) {
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const [saveStatus, setSaveStatus] = useState<{ id: string; state: "saving" | "saved" | "failed" }>({ id: "", state: "saved" });

  const userId = useUserId();
  const [school, saveSchool] = useSchool();
  const [schoolDraft, setSchoolDraft] = useState("");
  const [policy, setPolicy] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  const [contentsState, setContentsState] = useState<Record<string, { busy: boolean; error: string }>>({});
  const contentsRequests = useRef<Record<string, number>>({});
  // React live until the student returns: an audit that finishes while this module is unmounted
  // must still be persisted, but must not fire further model calls with no report to show.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setCourses(load());
  }, []);

  // Signed in: the account is the source of truth, but the device list is merged in, never
  // replaced by it — an audit whose save failed or was still in flight must not be erased by
  // the next sync. Local-only audits are retried upward so the account becomes complete.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const remote = await loadAudits();
      if (remote === null) return;
      const remoteCourses = remote as StoredCourse[];
      const remoteIds = new Set(remoteCourses.map((c) => c.id));
      const localOnly = load().filter((c) => !remoteIds.has(c.id));
      const merged = [...remoteCourses, ...localOnly];
      // Backfill termId for audits saved before term inference existed
      for (const c of merged) {
        if (!c.termId) {
          const text = c.pages?.map((p) => p.text).join(" ") ?? "";
          const inferred = inferTermId({ fileName: c.report.fileName, text });
          if (inferred) c.termId = inferred;
        }
      }
      setCourses(merged);
      save(merged);
      for (const c of localOnly) await saveAudit(c);
    })();
  }, [userId]);

  function update(next: StoredCourse[]) {
    setCourses(next);
    save(next);
  }

  /** Stores one course by merging into what is on the device now. A late response from an
   *  unmounted panel must never overwrite audits saved while the student was elsewhere. */
  function appendSave(course: StoredCourse) {
    try {
      const existing = load();
      if (existing.some((c) => c.id === course.id)) return;
      window.localStorage.setItem(STORE_KEY, JSON.stringify([...existing, course]));
    } catch {
      // Storage may be full or blocked; the account save still ran.
    }
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
      if (done) {
        setSaveStatus({ id, state: "saving" });
        try {
          await saveAudit({ id, report: done.report, pages });
          setSaveStatus({ id, state: "saved" });
        } catch {
          setSaveStatus({ id, state: "failed" });
        }
      }
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
          setSaveStatus({ id, state: "saving" });
          saveAudit(updated).then(() => setSaveStatus((s) => s.id === id ? { id, state: "saved" } : s)).catch(() => setSaveStatus((s) => s.id === id ? { id, state: "failed" } : s));
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

  async function onAudit(input: AuditInput, signal: AbortSignal) {
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), fileName: input.fileName, pageCount: input.pageCount, pages: input.pages }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The audit failed.");
      const report: AuditReport = { ...data.report, ...(input.courseCode ? { courseCode: input.courseCode } : {}), ...(input.scanned ? { textSource: "ocr" } : {}) };
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const termId = (input as { termId?: string | null }).termId ?? inferTermId({ fileName: input.fileName, text: input.pages.map((p) => p.text).join(" ") });
      const course: StoredCourse = { id, report, pages: input.pages, createdAt, termId };
      // The student may have opened another screen while the audit ran: persist the result
      // regardless (merge into device storage, never a stale-list overwrite), keep the live
      // panel in sync when mounted, and only auto-run the policy check if they are still here.
      appendSave(course);
      setCourses((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, course]));

      setSaveStatus({ id, state: "saving" });
      saveAudit(course)
        .then(() => setSaveStatus((s) => s.id === id ? { id, state: "saved" } : s))
        .catch(() => setSaveStatus((s) => s.id === id ? { id, state: "failed" } : s));

      if (mounted.current) {
        setOpenId(id);
        void runPolicyCheck(id, input.pages);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      throw err;
    }
  }

  const open = courses.find((c) => c.id === openId);

  return (
    <main>
      <h1 className="noprint">DA Syllabus Auditor</h1>
      {!open && (
        <SyllabusInput
          disclosure={disclosure}
          signedIn={!!userId}
          onAudit={(input, signal) => onAudit(input, signal).catch((err) => { setStatus({ step: "error", message: err instanceof Error ? err.message : "The audit failed." }); })}
        />
      )}
      {status.step === "working" && <p role="status">{status.message}</p>}
      {status.step === "error" && <p role="alert" className="warn">{status.message}</p>}

      {open ? (
        <>
          <button type="button" className="noprint" onClick={() => setOpenId(null)}>Back to term view</button>
          {userId && school === null && (
            <form className="noprint" onSubmit={(e) => { e.preventDefault(); if (schoolDraft.trim().length >= 3) void saveSchool(schoolDraft); }}>
              <label>Which school are you at? <input type="text" value={schoolDraft} onChange={(e) => setSchoolDraft(e.target.value)} placeholder="University of Oregon" required minLength={3} /></label>{" "}
              <button type="submit">Save school</button>
            </form>
          )}
          <Report key={open.id} report={open.report} pages={open.pages} policy={{ school: school ?? null, busy: policy.busy, error: policy.error, onRun: () => void runPolicyCheck(open.id, open.pages), contentsBusy: contentsState[open.id]?.busy, contentsError: contentsState[open.id]?.error, onRunContents: (context) => void runRequiredContents(open, context), courseTerm: open.termId ?? null }} />
          {saveStatus.id === open.id && (
            <p className="muted noprint">
              {saveStatus.state === "saving" ? "Saving..." : saveStatus.state === "saved" ? "Saved to your account" : "Could not save to your account. Try signing in again."}
            </p>
          )}
        </>
      ) : (
        <>
          {userId && school === null && (
            <form className="noprint" onSubmit={(e) => { e.preventDefault(); if (schoolDraft.trim().length >= 3) void saveSchool(schoolDraft); }}>
              <label>Which school are you at? <input type="text" value={schoolDraft} onChange={(e) => setSchoolDraft(e.target.value)} placeholder="University of Oregon" required minLength={3} /></label>{" "}
              <button type="submit">Save school</button>
            </form>
          )}
          <TermView
            courses={courses}
            onOpen={setOpenId}
            onRemove={(id) => {
              update(courses.filter((c) => c.id !== id));
              void deleteAudit(id);
            }}
          />
        </>
      )}
      {!open && <DepartmentView courses={courses} evidence={departmentEvidence} school={school} />}
    </main>
  );
}

