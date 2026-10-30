# DA Syllabus Auditor

A student uploads a syllabus and gets a plain-language audit: what it says about grading, late work, attendance, accessibility and whose perspectives it includes. Every finding rests on an exact quote that code checks against the page. The app then compares the syllabus with the school's own written policies, says who to go to when something is wrong, and suggests wording for each fix. University of Oregon (UO) comes first.

Built for the Meta Global AI Developer Hackathon. Live: https://da-syllabus-auditor-hkrr.vercel.app

## Why it matters

Most students never read a syllabus against the rules their school publishes, and few know which office to ask. The app does that comparison in under a minute and hands the student questions to ask, a message to send, and the office to send it to. It describes what documents say. It does not label a course or an instructor, and it gives no legal or academic advice.

## What it does

| Feature | What the student gets |
| --- | --- |
| Audit | Five dimensions graded from verified quotes, a "Start here" box of the first things to ask about, and a note on anything it could not assess |
| Fixes | A question, a message and suggested wording for each finding |
| Against your school's policies | The syllabus compared with ten UO policies (late work, attendance, accommodations, academic integrity, incompletes, final exams, dead week, religious observance, grievances, mandatory reporting). A verdict shows only where two models agree |
| Required contents | UO's required syllabus contents, found or not, with the quote |
| Who do I go to? | For five situations, the office the UO pages name, the exact quote, and a message to send |
| UO against itself | Places where UO's own policies disagree |
| Find funding | Opportunities matched to the student's profile |
| Schools page (owner only) | A private list of where syllabi differ from school policy, by school, topic and instructor |

## Meta tooling

- **Meta Model API, `muse-spark-1.3`** (`/v1/responses`) does the analysis: proposing passages, comparing documents, finding offices. The `web_search` tool finds opportunities and policy pages.
- **Muse Spark Open on Baseten** reads the policy comparison a second time. A verdict is shown only where both models agree, otherwise the topic is marked disputed. It also takes over if Meta does not answer, and the report says so.
- **Modal** runs OCR (tesseract) for scanned PDFs. Page images go in, text comes out, nothing is stored.
- **Code decides, not the model.** Grades, quote checks, silence, and instructor names are computed in code. A finding with no verified quote is dropped.

## How a check works

```text
PDF or text -> page text (scans: OCR on Modal)
  -> Meta proposes passages and signal codes
  -> code verifies each quote is an exact substring of its page, then grades
  -> report
Policy check: saved UO policy quotes (re-verified each use) + syllabus
  -> Meta and Baseten each propose a relation per topic
  -> code verifies quotes and silence; shows only where both agree
```

## Privacy

The PDF stays in the browser; only its text is sent for analysis. Audits are saved in the browser, and to the student's account when signed in (row-level security). One disclosed exception: where a syllabus differs from its school's policy, the verified quotes, instructor name and school go to a private list with no user id. Nothing is shared or used for training.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Supabase (auth, Postgres, row-level security), `pdfjs-dist`, Playwright, Vercel, Modal, Baseten.

## Run it

```text
npm install
cp .env.example .env.local   # fill in the keys
npm run dev                  # http://localhost:3000
```

Checks: `npx tsc --noEmit`, `npm run lint`, `node --test "lib/**/*.test.mts"`, `npm run test:e2e` (the model and OCR calls are mocked). Environment variables: `MODEL_API_KEY`, `MODEL_PROVIDER`, `BASETEN_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MODAL_OCR_URL`, `OCR_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` (server-only; set in Vercel, never the browser). Database: run `db/schema.sql`, then `db/002-policy-gaps.sql`, then `db/003-policy-gaps-server-only.sql`.

## Judging criteria

| Criterion | Where to look |
| --- | --- |
| Impact | Students get the office to contact and a message to send, not only a list of problems; UO policies are quoted from the school's own pages |
| Meta tooling | `lib/meta.ts` (Muse Spark, `web_search`, Baseten fallback), `lib/policy/compare.ts` (two-model agreement), `modal/ocr.py` |
| Demo | `docs/demo-script.md` |
| Technical | Quote verification in `lib/verify.ts`, code-side grading in `lib/rubric.ts`, 54 unit tests and 15 E2E tests |

## Known limits

- UO only; other schools use a live search for their policies and are less reliable.
- 56 scanned UO policy PDFs are not yet read, so some topics have thin coverage.
- Model answers can vary between runs; the two-model check marks those topics disputed instead of guessing.
- A signed-in user could insert fake rows into the private list; a server route with a service key is needed before any outreach.

More detail: `CLAUDE.md`, `docs/handoff-muse-code.md`, `docs/spec-da-syllabus-auditor-v1.md`.
