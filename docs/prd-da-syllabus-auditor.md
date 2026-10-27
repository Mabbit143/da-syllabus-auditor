<!-- Transcribed from the user-attached DA_Syllabus_Auditor_PRD.pdf; PDF line wrapping retained. -->

> **Status (2026-10-27): project started and built.** The hackathon began 2026-10-26 (kickoff 12:00 PM ET); the app described here is implemented and live on Vercel. This PRD remains the product authority. Current build contract and open checks: `docs/spec-da-syllabus-auditor-v1.md` and `docs/handoff-muse-code.md`. Open questions below were answered during the build (stack: Next.js on Vercel + Supabase; grading: equal weights, approved 2026-10-26).

PRD: DA Syllabus Auditor
Repo: da-syllabus-auditor — PRD lives at docs/prd-da-syllabus-auditor.md in that repo.
Feature: Upload a university syllabus, get a graded audit for bias and transparency, with
verbatim-passage receipts. Users: Non-traditional, first-generation, returning, and low-income
students auditing a course before the add/drop deadline. Secondary: students with disabilities,
working parents, and students balancing heavy outside obligations. Stack: Web app. Analysis via
Meta Model API (Muse Spark series). Hosting: FREE TIER ONLY — $0, no paid hosting, no paid
services (stated Oct 26, 2026; she has no money for another week). Frontend framework and
storage: open question, see below. No LMS/Canvas integration in v1.
Problem statement + success metrics
Problem: A syllabus is a contract students sign blind. Penalties, grading weights, and
accommodation processes are often buried, vague, or punitive, and the perspectives a course
centers are invisible until week 3. Existing tools (e.g. DormWay) organize deadlines, grading
weights, and late policy well — they do not audit who the rules assume you are, or what they
hide.
Success metrics:
Audit completes for a typical syllabus PDF in under 60 seconds, end to end.
100% of flags and grades cite a verbatim passage from the uploaded syllabus. A claim with
no passage is not shown as a finding; it is shown as "not found in this syllabus."
A student can read the audit in under 2 minutes and name the course's biggest risk and its
old-guard vs. inclusive lean, with reasons.
Hackathon: working demo, 2-minute video, submission by Nov 4, 3 PM PT target (6 PM PT
hard stop).
User stories with acceptance criteria
1. As a student, I upload a syllabus PDF so I can audit it before add/drop.
Accepts PDF upload; shows file name and page count; rejects non-PDF with a plain error.
Audit runs without manual transcription.
2. As a student, I see a bias and transparency grade per dimension, not just a single score.
Five dimensions, each graded and explained: Transparency, Punitive vs. flexible,
Accessibility in practice, Whose perspectives are in the room, Hidden curriculum.
Each dimension shows its grade, 1-3 supporting passages quoted verbatim, and what is
missing, if anything.

3. As a student, I see an overall old-guard vs. inclusive read.
One plain-language summary (old-guard leaning, mixed, or inclusive leaning) derived
from the five dimension grades, with the breakdown visible. No opaque single number
without explanation.
4. As a student, I see the underlying policy risks.
Attendance penalties, grade-weight concentration, and late-work rules flagged with
passage, weight/percentage where stated, and plain-language impact.
5. As a student, I can challenge a grade.
Every grade and flag links to its passage in context, so the student can read the source
and disagree.
Scope: what ships in v1, what does not
Ships in v1:
Single syllabus PDF upload and text extraction.
Five-dimension bias and transparency audit with verbatim citations.
Overall old-guard vs. inclusive summary with breakdown.
Attendance, grade-weight, and late-policy risk flags.
Plain-language audit report view, printable/shareable as a page.
Does NOT ship in v1:
Multi-syllabus term view, crunch-week map, or cross-course comparison (stretch, only if v1 is
done and frozen).
Canvas/LMS sync, calendar integration, or grade-math simulation.
Draft emails to professors or advisors.
Professor, department, or institutional dashboards.
Any claim about author identity, demographics, or intent not present in the syllabus text. If it
is not in the document, it is flagged as absent, not invented.
Data model
New app, no migration. Entities:
Syllabus: id, file name, page count, extracted text, uploaded at.
Passage: id, syllabus id, verbatim text, page/section locator.
Flag: id, syllabus id, type (attendance | grade-weight | late-policy | transparency |
accessibility | perspective | hidden-curriculum), severity, passage ids, plain-language
explanation.

DimensionScore: id, syllabus id, dimension, grade, rationale, passage ids, missing-evidence
note.
AuditReport: id, syllabus id, overall read (old-guard leaning | mixed | inclusive leaning),
dimension scores, flags, generated at.
No user accounts in v1 unless the chosen stack makes them trivial. Uploaded syllabi are not
shared, published, or used to train anything.
Edge cases + failure states
Scanned/image-only PDF or unreadable text: fail plainly ("could not read text from this file") —
never fake an audit from a filename or guess.
Syllabus with no readings list, no accessibility section, or no attendance policy: report that
section as "not found," do not infer a policy.
Ambiguous or contradictory policies: flag both passages and mark the dimension as
mixed/unclear, not resolved by the model.
Model output with no verbatim passage: dropped before display. Citation is a gate, not a
decoration.
Very long syllabus: extract and audit by section; if a section cannot be processed, say which
section was skipped.
Legal/advice boundary: this is an audit of a document, not legal advice, academic advice, or a
claim that a course is discriminatory. Language in the report says what the text shows, not
what the professor intends.
Open questions for Mabbit to answer
1. Stack: what frontend/hosting/storage do you want this built on for the hackathon (e.g.
Lovable, Replit, plain web app)? Meta Model API is the analysis layer either way.
2. Demo syllabus — DECIDED Oct 26, 2026: her favorite syllabus, Fall 2025 Games and Culture,
from her first semester at UO. Annotated copy received Oct 26, 2026
( GamesSyllabus2025annotated.pdf, highlights only, no comment annotations in the usual
sense — but the highlights carry 19 note texts). Clean copy made Oct 26, 2026 by stripping all
19 highlights: GamesSyllabus2025_clean.pdf (9 pages, 0 highlights left, original untouched).
The 19 highlight notes are saved separately as a test checklist:
GamesSyllabus2025_highlight_notes.md — the auditor should ideally surface similar issues
on its own, without reading these notes.
3. Grading weights: are the five dimensions weighted equally for the overall old-guard vs.
inclusive read, or should Transparency and Punitive vs. flexible count more?
4. After the hackathon, does this live as a DA product, a free student tool, or both? That decides
accounts and storage, which v1 deliberately avoids.
