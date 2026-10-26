"use client";

import { useState } from "react";
import Report from "@/components/Report";
import { extractPages } from "@/lib/extract";
import type { AuditReport, Page } from "@/lib/types";

type State =
  | { step: "idle" }
  | { step: "working"; message: string }
  | { step: "error"; message: string }
  | { step: "done"; report: AuditReport; pages: Page[] };

export default function Home() {
  const [state, setState] = useState<State>({ step: "idle" });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setState({ step: "error", message: "Please choose a PDF file." });
      return;
    }
    try {
      setState({ step: "working", message: `Reading ${file.name}…` });
      const { pageCount, pages } = await extractPages(file);
      if (pages.reduce((n, p) => n + p.text.length, 0) < 200) {
        setState({ step: "error", message: "Could not read text from this file." });
        return;
      }
      setState({ step: "working", message: `Auditing ${pageCount} pages…` });
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), fileName: file.name, pageCount, pages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The audit failed.");
      setState({ step: "done", report: data.report, pages });
    } catch (err) {
      console.error("[audit] failed:", err);
      setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  return (
    <main>
      <h1 className="noprint">DA Syllabus Auditor</h1>
      {state.step !== "done" && (
        <section className="noprint">
          <p>Upload a syllabus PDF to see how it treats students, with quotes you can check yourself. The PDF stays in your browser; only its text is sent for analysis, and nothing is saved.</p>
          <input type="file" accept="application/pdf" onChange={(e) => onFile(e.target.files?.[0])} disabled={state.step === "working"} />
        </section>
      )}
      {state.step === "working" && <p role="status">{state.message}</p>}
      {state.step === "error" && <p role="alert" className="warn">{state.message}</p>}
      {state.step === "done" && (
        <>
          <button type="button" className="noprint" onClick={() => setState({ step: "idle" })}>Audit another syllabus</button>
          <Report report={state.report} pages={state.pages} />
        </>
      )}
    </main>
  );
}
