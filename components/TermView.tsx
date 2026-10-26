"use client";

import type { AuditReport } from "@/lib/types";

export interface Course {
  id: string;
  report: AuditReport;
}

const WEEKS = 16;

// Deterministic risk points: High flag 2, Medium flag 1, each Weak dimension 1.
export function riskPoints(r: AuditReport): number {
  return (
    r.flags.reduce((n, f) => n + (f.severity === "high" ? 2 : 1), 0) +
    r.dimensions.filter((d) => d.status === "weak").length
  );
}

export default function TermView({ courses, onOpen, onRemove }: {
  courses: Course[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (courses.length === 0) return null;
  const ranked = [...courses].sort((a, b) => riskPoints(b.report) - riskPoints(a.report));

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const items = courses.flatMap((c) =>
      c.report.assessments.filter((a) => a.week === i + 1).map((a) => ({ course: c.report.fileName, ...a })),
    );
    const weight = items.reduce((n, a) => n + (a.percent ?? 0), 0);
    return { week: i + 1, items, weight, crunch: items.length >= 3 };
  });

  return (
    <section>
      <h3>Term view ({courses.length} syllabus{courses.length === 1 ? "" : "es"})</h3>
      <p className="muted">
        Risk points: High flag = 2, Medium flag = 1, each Weak dimension = 1. Weeks assume every course shares the
        same term calendar. Everything stays in this browser.
      </p>
      <table className="term">
        <thead>
          <tr><th>Course</th><th>Overall read</th><th>Risk points</th><th>Biggest risk</th><th /></tr>
        </thead>
        <tbody>
          {ranked.map((c) => {
            const risk = c.report.biggestRiskIndex === null ? null : c.report.flags[c.report.biggestRiskIndex];
            return (
              <tr key={c.id}>
                <td><button type="button" className="link" onClick={() => onOpen(c.id)}>{c.report.fileName}</button></td>
                <td>{c.report.overall.label ?? "unavailable"}</td>
                <td>{riskPoints(c.report)}</td>
                <td>{risk ? risk.explanation : "None supported"}</td>
                <td><button type="button" className="link noprint" onClick={() => onRemove(c.id)}>Remove</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p><strong>Highest risk to consider dropping: </strong>{riskPoints(ranked[0].report) > 0 ? ranked[0].report.fileName : "none stands out in the assessed text"}</p>

      <h4>Crunch-week map</h4>
      <div className="weeks">
        {weeks.map((w) => (
          <div key={w.week} className={`week ${w.crunch ? "crunch" : ""}`} title={w.items.map((a) => `${a.course}: ${a.what}`).join("\n")}>
            <strong>W{w.week}</strong>
            <span>{w.items.length || "–"}</span>
            {w.weight > 0 && <small>{w.weight}%</small>}
          </div>
        ))}
      </div>
      <p className="muted">Highlighted weeks have 3 or more assessments across your courses. Hover a week to list them.</p>
    </section>
  );
}
