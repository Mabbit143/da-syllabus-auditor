"use client";

import type { AuditReport } from "@/lib/types";
import { previousTermId, termLabel, termOf } from "@/lib/term";

export interface Course {
  id: string;
  report: AuditReport;
  /** ISO timestamp; missing on audits saved before term tracking existed (treated as the current term). */
  createdAt?: string;
}

// UO teaching weeks. Assessments outside this range stay visible below the map.
const WEEKS = 10;

// Deterministic risk points: High flag 2, Medium flag 1, each Weak dimension 1.
export function riskPoints(r: AuditReport): number {
  return (
    r.flags.reduce((n, f) => n + (f.severity === "high" ? 2 : 1), 0) +
    r.dimensions.filter((d) => d.status === "weak").length
  );
}

function termIdOf(course: Course): string {
  return termOf(course.createdAt ? new Date(course.createdAt) : new Date()).id;
}

function average(courses: Course[]): number {
  if (courses.length === 0) return 0;
  return Math.round((courses.reduce((n, c) => n + riskPoints(c.report), 0) / courses.length) * 10) / 10;
}

function CourseTable({ courses, onOpen, onRemove }: { courses: Course[]; onOpen: (id: string) => void; onRemove: (id: string) => void }) {
  const ranked = [...courses].sort((a, b) => riskPoints(b.report) - riskPoints(a.report));
  return (
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
  );
}

export default function TermView({ courses, onOpen, onRemove }: {
  courses: Course[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (courses.length === 0) return null;

  const thisTerm = termOf(new Date()).id;
  const lastTerm = previousTermId(thisTerm);
  const current = courses.filter((c) => termIdOf(c) === thisTerm);
  const previous = courses.filter((c) => termIdOf(c) === lastTerm);
  const earlier = courses.filter((c) => termIdOf(c) !== thisTerm && termIdOf(c) !== lastTerm);
  // Courses this term alone drive the crunch-week map; mixing terms' week numbers together would not be meaningful.
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const items = current.flatMap((c) =>
      c.report.assessments.filter((a) => a.week === i + 1).map((a) => ({ course: c.report.fileName, ...a })),
    );
    const weight = items.reduce((n, a) => n + (a.percent ?? 0), 0);
    return { week: i + 1, items, weight, crunch: items.length >= 3 };
  });
  const outsideWeeks = current.flatMap((c) =>
    c.report.assessments.filter((a) => a.week < 1 || a.week > WEEKS)
      .map((a) => ({ courseId: c.id, course: c.report.fileName, ...a })),
  );

  return (
    <section>
      <h3>Term view ({courses.length} {courses.length === 1 ? "syllabus" : "syllabi"})</h3>
      <p className="muted">
        Risk points: High flag = 2, Medium flag = 1, each Weak dimension = 1. Weeks assume every course shares the
        same term calendar. Everything stays in this browser.
      </p>

      {previous.length > 0 && (
        <p className="muted">
          {termLabel(thisTerm)} average risk points: {average(current)} ({current.length} {current.length === 1 ? "syllabus" : "syllabi"}).{" "}
          {termLabel(lastTerm)} average: {average(previous)} ({previous.length} {previous.length === 1 ? "syllabus" : "syllabi"}).
        </p>
      )}

      <h4>{termLabel(thisTerm)}{previous.length > 0 || earlier.length > 0 ? " (this term)" : ""}</h4>
      {current.length === 0 ? <p className="muted">Nothing audited yet this term.</p> : <CourseTable courses={current} onOpen={onOpen} onRemove={onRemove} />}

      {previous.length > 0 && (
        <>
          <h4>{termLabel(lastTerm)} (last term)</h4>
          <CourseTable courses={previous} onOpen={onOpen} onRemove={onRemove} />
        </>
      )}

      {earlier.length > 0 && (
        <details>
          <summary>Earlier terms ({earlier.length})</summary>
          <CourseTable courses={earlier} onOpen={onOpen} onRemove={onRemove} />
        </details>
      )}

      {current.length > 0 && (
        <p><strong>Highest risk to consider dropping this term: </strong>
          {(() => {
            const ranked = [...current].sort((a, b) => riskPoints(b.report) - riskPoints(a.report));
            return riskPoints(ranked[0].report) > 0 ? ranked[0].report.fileName : "none stands out in the assessed text";
          })()}
        </p>
      )}

      <h4>Crunch-week map (this term)</h4>
      <div className="weeks">
        {weeks.map((w) => (
          <div key={w.week} className={`week ${w.crunch ? "crunch" : ""}`} title={w.items.map((a) => `${a.course}: ${a.what}`).join("\n")}>
            <strong>W{w.week}</strong>
            <span>{w.items.length || "–"}</span>
            {w.weight > 0 && <small>{w.weight}%</small>}
          </div>
        ))}
      </div>
      <p className="muted">The map covers UO&rsquo;s {WEEKS}-week term. Highlighted weeks have 3 or more assessments across your courses. Hover a week to list them.</p>
      {outsideWeeks.length > 0 && (
        <div role="region" aria-label="Assessments outside the term map">
          <h5>Assessments outside the {WEEKS}-week map</h5>
          <p className="muted">These assessments remain saved. Their extracted week numbers fall outside this map; check the source schedule. They have not been moved or renumbered.</p>
          <ul>
            {outsideWeeks.map((a, i) => (
              <li key={`${a.courseId}:${a.passageId}:${i}`}>
                <button type="button" className="link" onClick={() => onOpen(a.courseId)}>{a.course}</button>: {a.what} — week {a.week}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
