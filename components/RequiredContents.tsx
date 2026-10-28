"use client";

import { useState } from "react";
import { UNKNOWN_CONTEXT, type CourseContext, type RequiredContents as ContentsResult } from "@/lib/policy/contents-types";

const STATUS = { found: "Found", needs_review: "Needs review", not_assessed: "Not assessed", not_applicable: "Not applicable" };
const APPLICABILITY = { current_snapshot: "Compared with the saved policy snapshot", historical_unverified: "Historical applicability unverified", unknown: "Policy applicability unknown", not_applicable: "Not applicable to this course context" };

export default function RequiredContents({ result, busy, error, onRun }: {
  result?: ContentsResult;
  busy: boolean;
  error: string;
  onRun: (context: CourseContext) => void;
}) {
  const [context, setContext] = useState<CourseContext>(result?.context ?? { ...UNKNOWN_CONTEXT });
  return (
    <section aria-label="Required syllabus contents" className="required-contents">
      <h3>Required syllabus contents</h3>
      <p>Compare the content of this syllabus with UO&rsquo;s saved requirements. Found means content was located, not that a requirement is fully satisfied. No verified evidence means not assessed.</p>
      <form className="noprint" onSubmit={(event) => { event.preventDefault(); onRun({ ...context }); }}>
        <fieldset disabled={busy}>
          <legend>Course context</legend>
          <label>Course term <select aria-label="Course term" value={context.term} onChange={(e) => setContext({ ...context, term: e.target.value as CourseContext["term"] })}>
            <option value="unknown">Unknown</option>{["winter", "spring", "summer", "fall"].map((term) => <option key={term} value={term}>{term}</option>)}
          </select></label>
          <label>Course year <input type="number" min="1900" max="2200" value={context.year ?? ""} placeholder="Unknown" onChange={(e) => setContext({ ...context, year: e.target.value ? Number(e.target.value) : null })} /></label>
          <label>Course level <select aria-label="Course level" value={context.level} onChange={(e) => setContext({ ...context, level: e.target.value as CourseContext["level"] })}>
            <option value="unknown">Unknown</option><option value="undergraduate">Undergraduate</option><option value="graduate">Graduate</option>
          </select></label>
          <label>Core Education course <select aria-label="Core Education course" value={context.coreEducation} onChange={(e) => setContext({ ...context, coreEducation: e.target.value as CourseContext["coreEducation"] })}>
            <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
          </select></label>
        </fieldset>
        <button type="submit" disabled={busy}>Check required contents</button>
      </form>
      {busy && <p role="status">Checking syllabus content and verifying source passages.</p>}
      {(error || result?.error) && <p role="alert" className="warn">{error || result?.error}</p>}
      {result && <>
        <p><strong>Results for: {result.context.term} {result.context.year ?? "year unknown"}, {result.context.level}; Core Education: {result.context.coreEducation}.</strong></p>
        <p className="muted">UO source snapshot: {result.snapshotDate}. Live wording may have changed. The standard statement is dated Fall 2026 in <a href="https://teaching.uoregon.edu/syllabus" target="_blank" rel="noopener noreferrer">UO&rsquo;s Syllabus Essentials</a>. Historical applicability requires an applicable policy version.</p>
        {result.coverage.status === "partial" && <p className="warn">Partial assessment. {result.coverage.skipped.join(" ")}</p>}
        {result.groups.map((group) => <details key={group.id} className="card">
          <summary>{group.label}</summary>
          <div className="contents-evidence">
            {group.components.map((component) => <div key={component.id} className="card">
              <h4>{component.label}: <span className="grade">{STATUS[component.status]}</span></h4>
              <p className="muted">{APPLICABILITY[component.applicability]}</p>
              {component.passages.map((passage) => <blockquote key={passage.id} className="quote"><p>{passage.text}</p><span className="where">This syllabus, page {passage.page}</span></blockquote>)}
              {component.passages.length === 0 && <p>{component.status === "not_applicable" ? "This requirement is not assessed for the selected course context." : "No verified content evidence was obtained. This does not establish that the content is absent."}</p>}
              <blockquote className="quote"><p>{component.policyQuote}</p><span className="where">UO policy snapshot: <a href={component.policyUrl} target="_blank" rel="noopener noreferrer">official source</a></span></blockquote>
              <p><strong>Question to ask:</strong> {component.question}</p>
            </div>)}
          </div>
        </details>)}
      </>}
    </section>
  );
}
