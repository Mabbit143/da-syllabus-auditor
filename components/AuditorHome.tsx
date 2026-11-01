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
import type { EvidenceRecord } from "@/lib/policy/evidence";
import type { AuditReport, Page } from "@/lib/types";

type StoredCourse = Course & { pages: Page[] };
type Status = { step: "idle" } | { step: "working"; message: string } | { step: "error"; message: string };

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
      update([...courses, { id, report, pages: input.pages, createdAt }]);
      
      setSaveStatus({ id, state: "saving" });
      saveAudit({ id, report, pages: input.pages, createdAt })
        .then(() => setSaveStatus((s) => s.id === id ? { id, state: "saved" } : s))
        .catch(() => setSaveStatus((s) => s.id === id ? { id, state: "failed" } : s));

      setOpenId(id);
      void runPolicyCheck(id, input.pages);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      throw err;
    }
  }

  const open = courses.find((c) => c.id === openId);

  return (
    <main>
      <h1 className="noprint">DA Syllabus Auditor</h1>
      <SyllabusInput
        disclosure={disclosure}
        signedIn={!!userId}
        onAudit={(input, signal) => onAudit(input, signal).catch((err) => { setStatus({ step: "error", message: err instanceof Error ? err.message : "The audit failed." }); })}
      />
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
          <Report key={open.id} report={open.report} pages={open.pages} policy={{ school: school ?? null, busy: policy.busy, error: policy.error, onRun: () => void runPolicyCheck(open.id, open.pages), contentsBusy: contentsState[open.id]?.busy, contentsError: contentsState[open.id]?.error, onRunContents: (context) => void runRequiredContents(open, context) }} />
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

