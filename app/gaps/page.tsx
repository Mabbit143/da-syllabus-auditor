"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/components/Nav";
import { loadGapReport, type GapGroup } from "@/lib/cloud";
import { byInstructor } from "@/lib/gaps";
import { TOPIC_LABEL } from "@/lib/policy/types";

const KIND_TEXT = {
  conflicts: "Conflicts with the school policy",
  adds_requirement: "Adds a step the school policy does not require",
  silent: "Not stated in the syllabus",
} as const;

export default function Gaps() {
  const userId = useUserId();
  const [groups, setGroups] = useState<GapGroup[] | null | undefined>(undefined);
  const [view, setView] = useState<"school" | "instructor">("school");

  useEffect(() => {
    if (!userId) return;
    loadGapReport().then(setGroups);
  }, [userId]);

  if (userId === undefined) return <main><h1>Policy gaps</h1></main>;
  if (!userId) return <main><h1>Policy gaps</h1><p>Sign in to view this page.</p></main>;
  if (groups === undefined) return <main><h1>Policy gaps</h1><p role="status">Loading…</p></main>;
  if (groups === null) return <main><h1>Policy gaps</h1><p>This page is not available for your account.</p></main>;

  return (
    <main>
      <h1>Policy gaps</h1>
      <p className="muted">Private. Each group counts distinct syllabi from one school that differ from that school&rsquo;s written policy on one topic. A group is flagged at 5 or more; below that it is shown as not yet flagged.</p>
      <p>
        <button onClick={() => setView("school")} disabled={view === "school"}>By school and topic</button>{" "}
        <button onClick={() => setView("instructor")} disabled={view === "instructor"}>By instructor</button>
      </p>
      {groups.length === 0 && <p>Nothing recorded yet.</p>}
      {view === "instructor" && byInstructor(groups).map((r) => (
        <div key={`${r.school}|${r.instructor ?? ""}`} className="card mixed">
          <h4><span style={{ textTransform: "capitalize" }}>{r.school}</span>: {r.instructor ?? "Instructor not named"}</h4>
          <ul>
            {r.items.map((i) => (
              <li key={`${i.topic}|${i.kind}`}>{TOPIC_LABEL[i.topic]}: {KIND_TEXT[i.kind]} · {i.syllabi} syllabus{i.syllabi === 1 ? "" : "es"}{i.flagged ? " · FLAGGED" : " · not yet flagged"}</li>
            ))}
          </ul>
        </div>
      ))}
      {view === "school" && groups.map((g) => (
        <div key={`${g.school}|${g.topic}|${g.kind}`} className={`card ${g.flagged ? "sev-high" : "mixed"}`}>
          <h4>
            <span style={{ textTransform: "capitalize" }}>{g.school}</span>: {TOPIC_LABEL[g.topic]} <span className="grade">{KIND_TEXT[g.kind]}</span>
          </h4>
          <p className="muted">{g.syllabi} syllabus{g.syllabi === 1 ? "" : "es"}{g.flagged ? " · FLAGGED" : " · not yet flagged"}</p>
          <details>
            <summary>Evidence</summary>
            {g.entries.map((e, i) => (
              <div key={i}>
                <p className="muted">Instructor: {e.instructor ?? "not named"} · {new Date(e.at).toLocaleDateString()}</p>
                {e.syllabusQuote && <blockquote className="quote"><p>&ldquo;{e.syllabusQuote}&rdquo;</p><span className="where">Syllabus page {e.syllabusPage}</span></blockquote>}
                <blockquote className="quote"><p>&ldquo;{e.schoolQuote}&rdquo;</p><span className="where"><a href={e.schoolUrl} target="_blank" rel="noopener noreferrer">School policy page</a></span></blockquote>
              </div>
            ))}
          </details>
        </div>
      ))}
    </main>
  );
}
