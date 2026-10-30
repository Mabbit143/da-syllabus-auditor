"use client";

import type { Course } from "@/components/TermView";
import { rollupByDepartment } from "@/lib/departments";
import { DIMENSIONS } from "@/lib/rubric";
import type { EvidenceRecord } from "@/lib/policy/evidence";

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
        </div>
      ))}
    </section>
  );
}
