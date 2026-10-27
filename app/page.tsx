"use client";

import { useEffect, useState } from "react";
import Report from "@/components/Report";
import TermView, { type Course } from "@/components/TermView";
import { useUserId } from "@/components/Nav";
import { deleteAudit, loadAudits, saveAudit } from "@/lib/cloud";
import { extractPages } from "@/lib/extract";
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

export default function Home() {
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ step: "idle" });

  const userId = useUserId();

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

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus({ step: "error", message: "Please choose a PDF file." });
      return;
    }
    try {
      setStatus({ step: "working", message: `Reading ${file.name}…` });
      const { pageCount, pages } = await extractPages(file);
      if (pages.reduce((n, p) => n + p.text.length, 0) < 200) {
        setStatus({ step: "error", message: "Could not read text from this file." });
        return;
      }
      setStatus({ step: "working", message: `Auditing ${pageCount} pages. This can take a minute or two…` });
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), fileName: file.name, pageCount, pages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The audit failed.");
      const report: AuditReport = data.report;
      const id = crypto.randomUUID();
      update([...courses, { id, report, pages }]);
      void saveAudit({ id, report, pages });
      setOpenId(id);
      setStatus({ step: "idle" });
    } catch (err) {
      console.error("[audit] failed:", err);
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const open = courses.find((c) => c.id === openId);

  return (
    <main>
      <h1 className="noprint">DA Syllabus Auditor</h1>
      <section className="noprint">
        <p>Upload a syllabus PDF to see how it treats students, with quotes you can check yourself. The PDF stays in your browser; only its text is sent for analysis. Audits are saved only in this browser. Add several syllabi to compare your term.</p>
        <input type="file" aria-label="Upload syllabus PDF" accept="application/pdf" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} disabled={status.step === "working"} />
      </section>
      {status.step === "working" && <p role="status">{status.message}</p>}
      {status.step === "error" && <p role="alert" className="warn">{status.message}</p>}

      {open ? (
        <>
          <button type="button" className="noprint" onClick={() => setOpenId(null)}>Back to term view</button>
          <Report report={open.report} pages={open.pages} />
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
