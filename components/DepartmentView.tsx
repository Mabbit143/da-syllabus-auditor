"use client";

import { useState } from "react";
import type { Course } from "@/components/TermView";
import { rollupByDepartment } from "@/lib/departments";
import { DIMENSIONS } from "@/lib/rubric";
import type { EvidenceRecord } from "@/lib/policy/evidence";

interface Packet {
  letter: string;
  citedQuotes: { course: string; quote: string; page: number }[];
  evidenceQuote: { quote: string; sourceUrl: string; page: number } | null;
}

type PacketState = { step: "idle" } | { step: "working" } | { step: "error"; message: string } | { step: "done"; packet: Packet };

function PacketBox({ courses, evidence }: { courses: Course[]; evidence: EvidenceRecord | undefined }) {
  const [state, setState] = useState<PacketState>({ step: "idle" });

  async function generate() {
    setState({ step: "working" });
    try {
      const res = await fetch("/api/departments/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses, evidence: evidence ? { quote: evidence.quote, sourceUrl: evidence.sourceUrl, page: evidence.page } : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not draft a letter.");
      setState({ step: "done", packet: data.packet as Packet });
    } catch (err) {
      console.error("[departments/packet] failed:", err);
      setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  return (
    <div>
      <p className="muted">
        This drafts a letter from only the quotes already verified above. Nothing is invented. Read it before sending anything.
      </p>
      <button type="button" className="noprint" onClick={() => void generate()} disabled={state.step === "working"}>
        {state.step === "working" ? "Drafting…" : "Generate accountability packet"}
      </button>
      {state.step === "error" && <p role="alert" className="warn">{state.message}</p>}
      {state.step === "done" && (
        <>
          <p className="draft">{state.packet.letter}</p>
          <p><strong>Cited quotes</strong></p>
          <ul>
            {state.packet.citedQuotes.map((q, i) => (
              <li key={i}>{q.course}, page {q.page}: &ldquo;{q.quote}&rdquo;</li>
            ))}
            {state.packet.evidenceQuote && (
              <li>
                Department&rsquo;s own published quote, page {state.packet.evidenceQuote.page}: &ldquo;{state.packet.evidenceQuote.quote}&rdquo;{" "}
                <a href={state.packet.evidenceQuote.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

export default function DepartmentView({ courses, evidence }: { courses: Course[]; evidence: EvidenceRecord[] }) {
  const rollups = rollupByDepartment(courses);
  if (rollups.length === 0) return null;
  return (
    <section>
      <h3>By department</h3>
      <p className="muted">
        Your own audited syllabi, grouped by department. This groups only your own account&rsquo;s syllabi
        — it never pools other students&rsquo; audits.
      </p>
      {rollups.map((r) => (
        <div key={r.code} className="card mixed">
          <h4>{r.code} ({r.courses.length} {r.courses.length === 1 ? "syllabus" : "syllabi"} so far)</h4>
          <ul>
            {DIMENSIONS.map(({ id, title }) => {
              const t = r.dimensions[id];
              return (
                <li key={id}>
                  {title}: {t.dominant ?? "Mixed"} ({t.strong} strong, {t.weak} weak, {t.mixed} mixed of {r.courses.length})
                </li>
              );
            })}
          </ul>
          {evidence.length > 0 && (
            <>
              <h5>What {r.code} itself publishes</h5>
              {evidence.map((e, i) => (
                <blockquote key={i} className="quote">
                  <p>&ldquo;{e.quote}&rdquo;</p>
                  <span className="where"><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">Source, page {e.page}</a></span>
                </blockquote>
              ))}
            </>
          )}
          <PacketBox courses={r.courses} evidence={evidence[0]} />
        </div>
      ))}
    </section>
  );
}
