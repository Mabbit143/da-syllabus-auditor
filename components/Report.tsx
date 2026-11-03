"use client";

import FixKit from "@/components/FixKit";
import RequiredContents from "@/components/RequiredContents";
import EvidenceDetails from "@/components/report/EvidenceDetails";
import SourceQuote, { MissingPassage } from "@/components/report/SourceQuote";
import type { CourseContext } from "@/lib/policy/contents-types";
import { findingsFromReport } from "@/lib/fixes";
import { pageLocator } from "@/lib/locator";
import { DIMENSION_EXPLAINER } from "@/lib/rubric";
import { AREA_LABELS, areaStatus } from "@/lib/report-presentation";
import { POLICY_TOPICS, TOPIC_LABEL, TOPIC_PLAIN, type Relation } from "@/lib/policy/types";
import type { AuditReport, AuthorBioCheck, AuthorBioOutcome, Page } from "@/lib/types";
import { buildIcs, downloadIcs } from "@/lib/ics";

const STATUS_TEXT = {
  strong: "Strong",
  weak: "Weak",
  mixed: "Mixed",
  not_found: "Not found in this syllabus",
  not_assessed: "Not assessed",
} as const;

/** A short plain summary computed from the findings, so a new reader knows what to do first. */
function StartHere({ report }: { report: AuditReport }) {
  const asks = findingsFromReport(report);
  const differs = (report.policyCheck?.items ?? []).filter((i) => i.relation === "conflicts" || i.relation === "adds_requirement").length;
  return (
    <section className="start-here">
      <h3>Start here</h3>
      {asks.length === 0 ? (
        <p>No problems with a quote behind them were found. The sections below show what the syllabus does say.</p>
      ) : (
        <>
          <p>{asks.length} thing{asks.length === 1 ? "" : "s"} worth asking your instructor about. The first few:</p>
          <ul>{asks.slice(0, 3).map((f) => <li key={f.id}>{f.label}</li>)}</ul>
        </>
      )}
      {differs > 0 && <p>{differs} place{differs === 1 ? "" : "s"} where this syllabus differs from your school&rsquo;s written policy. See &ldquo;Against your school&rsquo;s own policies&rdquo; below.</p>}
      <p className="muted noprint">Questions to ask, messages you can send and suggested wording are in <a href="#fixes">What to do about it</a>, at the end.</p>
    </section>
  );
}

const RELATION_PLAIN: Record<Relation, string> = {
  matches: "The syllabus agrees with the school's written rule.",
  conflicts: "The syllabus and the school's written rule say different things. You may want to ask the instructor which one applies to you.",
  adds_requirement: "The syllabus asks for something the school's rule does not, or sends you somewhere first. That may be fine, but check the school's rule below.",
  silent: "The syllabus does not mention this topic, but the school has a written rule about it.",
  disputed: "Two separate checks read this differently, so treat it as unclear and read both quotes yourself.",
};

const RELATION_TEXT: Record<Relation, string> = {
  matches: "Matches the school policy",
  conflicts: "Conflicts with the school policy",
  adds_requirement: "Adds a step the school policy does not require",
  silent: "Not stated in this syllabus",
  disputed: "Two checks read this differently, so no verdict is shown",
};

const BIO_OUTCOME_TEXT: Record<AuthorBioOutcome, string> = {
  insider_stated: "Public bio states a background in the community the reading covers — counts for this dimension.",
  outsider_stated: "Public bio states a background outside it — counts against this dimension.",
  no_stated_relation: "Bio found, but it does not state the author's own background — not counted.",
  not_found: "No public bio found for this author.",
  bio_unverified: "Bio found, but its text could not be verified on the page — not counted.",
  check_failed: "The lookup failed this run.",
};

export interface PolicyProps {
  school: string | null;
  busy: boolean;
  error: string;
  onRun: () => void;
  contentsBusy?: boolean;
  contentsError?: string;
  onRunContents?: (context: CourseContext) => void;
  /** The term the student picked when uploading, so the required-contents form is prefilled. */
  courseTerm?: string | null;
}

export default function Report({ report, pages, policy }: { report: AuditReport; pages: Page[]; policy?: PolicyProps }) {
  const policySchool = policy?.school ?? report.policyCheck?.school;
  const byId = new Map(report.passages.map((p) => [p.id, p]));
  const risk = report.biggestRiskIndex === null ? null : report.flags[report.biggestRiskIndex];
  const riskPage = risk ? byId.get(risk.passageId)?.page : undefined;

  return (
    <article className="report">
      <header>
        <h2>{report.fileName}</h2>
        <p className="muted">{report.pageCount} pages. This audit describes what the document says; it is not legal or academic advice.</p>
        {report.modelNote && <p className="warn">{report.modelNote}</p>}
        {report.textSource === "ocr" && <p className="warn">This file was a scan. Its text was read from page images by OCR, so quotes may contain reading errors.</p>}
        {report.sources && (
          <p className="muted">
            Assembled from {report.sources.length} pieces: {report.sources.map((s) => `${s.label} (${s.pageCount} page${s.pageCount === 1 ? "" : "s"})`).join(", ")}.
            {" "}A syllabus scattered across several separate pieces is itself worth noting.
          </p>
        )}
        {report.coverage.status === "partial" && (
          <div className="warn" role="status">
            <p><strong>Partial audit — some notes were skipped:</strong></p>
            <ul>{report.coverage.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
      </header>

      <StartHere report={report} />

      <section className="overall">
        <h3>Overall read</h3>
        <p className="big">{report.overall.label ?? "Overall read unavailable"}</p>
        {report.overall.characterization && <p className="big" style={{ marginTop: "-0.5em" }}>{report.overall.characterization}.</p>}
        <p className="muted">{report.overall.reason}</p>
        <p>
          <strong>Biggest risk among attendance, grade weight and late work: </strong>
          {risk ? `${risk.explanation} (${riskPage === undefined ? "page unknown" : pageLocator(pages, riskPage)})` : "No supported policy risk was identified in the assessed text."}
        </p>
      </section>

      {report.assessments.length > 0 && (
        <section>
          <h3>Calendar</h3>
          <p className="muted">
            {report.assessments.length} dated {report.assessments.length === 1 ? "item" : "items"} found (week numbers from the syllabus). Add them to your calendar and verify the dates — week numbers are estimates.
          </p>
          <button
            type="button"
            onClick={() => {
              const ics = buildIcs({ fileName: report.fileName, assessments: report.assessments });
              const base = report.fileName.replace(/\.pdf$/i, "");
              downloadIcs(`${base}-due-dates.ics`, ics);
            }}
          >
            Download due dates (.ics)
          </button>
        </section>
      )}

      <section>
        <h3>Five dimensions</h3>
        <p className="muted">Every status is decided by code from verified quotes. Open a finding to see the exact wording and where it came from.</p>
        {report.dimensions.map((d) => {
          const isVague = d.dimension === "perspectives" || d.dimension === "hidden";
          // Present up to 3 hits, but for vague dimensions cap at 2 to reduce noise while keeping verification.
          const rawHits = [...d.hits.filter((h) => h.polarity === 1).slice(0, 2), ...d.hits.filter((h) => h.polarity === -1).slice(0, 2)].slice(0, 3);
          const hits = isVague ? rawHits.slice(0, 2) : rawHits;
          // Plain status label: "Mixed" not "Mixed / unclear"; limited evidence stays distinct but now has a plain explainer alongside via areaStatus.
          const statusLabel = d.status === "not_found" && d.notes?.length ? "No supported signal" : d.status === "mixed" && (d.positive === 0 || d.negative === 0) ? "Limited evidence" : STATUS_TEXT[d.status];
          const plainSummary = areaStatus(d);
          return (
            <div key={d.dimension} className={`card ${d.status}`}>
              <h4>
                {d.title}: <span className="grade">{statusLabel}</span>
                {d.characterization && <span className="grade characterization"> — {d.characterization}</span>}
              </h4>
              <p className="muted">{AREA_LABELS[d.dimension]}</p>
              <p className="muted dim-explainer">{DIMENSION_EXPLAINER[d.dimension]}</p>
              <p className="muted">{plainSummary}</p>
              {d.notes?.map((n) => <p key={n} className="muted">{n}</p>)}
              {/* The reading-list author check is shown in full whether or not any bio counted, so the grade is auditable. */}
              {d.dimension === "perspectives" && report.sourceAuthors && report.sourceAuthors.authors.length > 0 && (
                <details className="bio-audit noprint">
                  <summary>
                    Reading-list author check: {report.sourceAuthors.sampled} of {report.sourceAuthors.verified} author{report.sourceAuthors.verified === 1 ? "" : "s"} checked
                    {report.sourceAuthors.sampled < report.sourceAuthors.verified ? " (random sample)" : ""}
                  </summary>
                  <p className="muted">
                    The syllabus&rsquo;s own reading list was used: up to 3 public bios per sampled author were searched (Wikipedia included when found), each quote verified word-for-word against its source page. Only a bio whose own text states the author&rsquo;s background counts toward the grade — a named based-at / educated-in place counts, a bare employer name does not, and a name alone never counts. Each hit appears with its quote above.
                  </p>
                  <ul>
                    {report.sourceAuthors.authors.map((a: AuthorBioCheck, i: number) => (
                      <li key={`${a.author}-${i}`}>
                        <strong>{a.author}</strong> — {BIO_OUTCOME_TEXT[a.outcome]}
                        {a.topic && <span className="muted"> (reading covers: {a.topic})</span>}
                        {a.url && <> <a href={a.url} target="_blank" rel="noopener noreferrer">bio source</a></>}
                        {a.pieces?.length ? (
                          <ul>
                            {a.pieces.map((p, j) => (
                              <li key={j}>
                                &ldquo;{p.quote}&rdquo; — {p.relation}{" "}
                                <a href={p.url} target="_blank" rel="noopener noreferrer">source</a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {hits.map((h) => (
                <div key={h.passageId}>
                  <p className="signal">{h.polarity === 1 ? "+" : "−"} {h.label}</p>
                  {byId.get(h.passageId) ? (
                    <EvidenceDetails id={`evidence-${h.passageId}`} label="Read the syllabus wording">
                      <SourceQuote passage={byId.get(h.passageId)!} pages={pages} evidenceId={`quote-${h.passageId}`} />
                    </EvidenceDetails>
                  ) : (
                    <MissingPassage />
                  )}
                  {h.pairedPassageId &&
                    (byId.get(h.pairedPassageId) ? (
                      <EvidenceDetails id={`evidence-${h.pairedPassageId}`} label="Read the second syllabus wording">
                        <SourceQuote passage={byId.get(h.pairedPassageId)!} pages={pages} evidenceId={`quote-${h.pairedPassageId}`} />
                      </EvidenceDetails>
                    ) : (
                      <MissingPassage />
                    ))}
                  {h.evidence && (
                    <p className="muted">
                      Author bio ({h.evidence.author}): &ldquo;{h.evidence.quote}&rdquo;{" "}
                      <a href={h.evidence.url} target="_blank" rel="noopener noreferrer">source</a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <section>
        <h3>Policy risks</h3>
        {report.flags.length === 0 && <p>No attendance, grade-weight or late-work risk was supported by the text.</p>}
        {report.flags.map((f, i) => (
          <div key={i} className={`card sev-${f.severity}`}>
            <h4>
              {f.kind === "weight" ? "Grade weight" : f.kind === "late" ? "Late work" : "Attendance"}:{" "}
              <span className="grade">{f.severity}</span>
            </h4>
            <p>{f.explanation}</p>
            {(f.passageIds ?? [f.passageId]).map((id) =>
              byId.get(id) ? (
                <EvidenceDetails key={id} id={`evidence-flag-${id}`} label="Read the syllabus wording">
                  <SourceQuote passage={byId.get(id)!} pages={pages} evidenceId={`quote-flag-${id}`} />
                </EvidenceDetails>
              ) : (
                <MissingPassage key={id} />
              ),
            )}
          </div>
        ))}
      </section>

      {policy && (
        <section>
          <h3>Against your school&rsquo;s own policies</h3>
          {!policySchool && <p className="muted">Sign in and add your school to compare this syllabus with its published policies.</p>}
          {policySchool && (!report.policyCheck || report.policyCheck.comparisonStatus === "not_run") && !policy.busy && (
            <>
              <p className="muted">The comparison with {policySchool}&rsquo;s written policies has not been run for this report.</p>
              <button type="button" className="noprint" onClick={policy.onRun}>Check against {policySchool}</button>
            </>
          )}
          {policy.busy && <p role="status">Looking up {policy.school}&rsquo;s published policies and comparing. The first time for a school can take a minute or two.</p>}
          {policy.error && <p role="alert" className="warn">{policy.error}</p>}
          {report.policyCheck && report.policyCheck.comparisonStatus !== "not_run" && report.policyCheck.items.length === 0 && (
            <p>No policies could be verified for {report.policyCheck.school}, so nothing was compared.</p>
          )}
          {report.policyCheck && report.policyCheck.comparisonStatus !== "not_run" && report.policyCheck.items.length > 0 && report.policyCheck.items.length < POLICY_TOPICS.length && (
            <p className="muted">Not compared this time (no verified quote): {POLICY_TOPICS.filter((t) => !report.policyCheck!.items.some((i) => i.topic === t)).map((t) => TOPIC_LABEL[t]).join(", ")}.</p>
          )}
          {report.policyCheck?.items.filter((it) => it.relation !== "matches").map((it) => (
            <div key={it.topic} className={`card ${it.relation === "matches" ? "strong" : (it.relation === "silent" || it.relation === "disputed") ? "mixed" : "sev-medium"}`}>
              <h4>{TOPIC_LABEL[it.topic]}: <span className="grade">{RELATION_TEXT[it.relation]}</span></h4>
              <p className="muted">{TOPIC_PLAIN[it.topic]}</p>
              <p><strong>What this means:</strong> {RELATION_PLAIN[it.relation]}</p>
              {it.syllabusQuote ? (
                <blockquote className="quote"><p>&ldquo;{it.syllabusQuote}&rdquo;</p><span className="where">This syllabus, {it.syllabusPage === undefined ? "page unknown" : pageLocator(pages, it.syllabusPage)}</span></blockquote>
              ) : (
                <p className="muted">Not found in this syllabus.</p>
              )}
              <blockquote className="quote"><p>&ldquo;{it.schoolQuote}&rdquo;</p><span className="where">{report.policyCheck!.school}: <a href={it.schoolUrl} target="_blank" rel="noopener noreferrer">official page</a></span></blockquote>
              {it.schoolProvenance && <p className="where">Reviewed document, PDF page {it.schoolProvenance.page}; image region {it.schoolProvenance.region.join(", ")}. Source extraction: {it.schoolProvenance.extractionMethod}. Reviewed {it.schoolProvenance.reviewedAt}.</p>}
            </div>
          ))}
        </section>
      )}

      {policy?.onRunContents && (policy.school ?? report.policyCheck?.school ?? "").trim().replace(/\s+/g, " ").toLowerCase() === "university of oregon" && (
        <RequiredContents result={report.policyCheck?.requiredContents} busy={policy.contentsBusy ?? false} error={policy.contentsError ?? ""} onRun={policy.onRunContents} pages={pages} courseTermId={policy.courseTerm} />
      )}

      <FixKit report={report} pages={pages} />

      <button type="button" className="noprint" onClick={() => window.print()}>
        Print or save this report
      </button>
    </article>
  );
}
