# DA Syllabus Auditor

A student-facing web app, built for the Meta Global AI Developer Hackathon. A student uploads a syllabus; the app audits it for bias, transparency and policy risks, suggests fixes per finding, finds funding, and (the main aim since 2026-10-27) compares the syllabus to the school's own written policies and keeps a private master list of discrepancies. University of Oregon (UO) comes first.

Every displayed finding rests on a verbatim quote that is verified against the source page. Tools that only point out problems and give no fixes are not acceptable.

## State (2026-10-28)

- Built and live on Vercel (short domain `da-syllabus-auditor-hkrr.vercel.app`, Deployment Protection off). Repository: `Mabbit143/da-syllabus-auditor`, branch `main`.
- Built: audit, fixes per finding, opportunity search, term view, Supabase sign-in and saved audits, policy check against ten UO policies read by Meta and Baseten (verdict only where both agree), Modal OCR for scanned PDFs, "Who do I go to?" navigator, owner-only gap list with by-instructor view, UO policy corpus.
- Verified 2026-10-28: env vars and Supabase redirects set (owner), the real 9-page demo PDF audits in 47 s on the live site, E2E 15 of 15, 54 unit tests. Not verified: scanned-PDF run on the live site, sign-in and saved-audit persistence on the live site, the five navigator answers against UO pages, and the Schools page with real data. Earlier, 2026-10-27: the policy lookup after the domain fix returns all five topics on `uoregon.edu` pages locally, and on Vercel a synthetic 9-page audit (14 s) and the UO policy check (23 s, 5 of 5 topics) both return HTTP 200 (see handoff sections 11 and 14).
- Submission is due Nov 4, 2026, 9 PM ET (7 PM MT): public repo, 3-minute demo video, Meta models. Judging: Impact 30%, Meta tooling 25%, Demo 25%, Technical 20%.
- `docs/handoff-muse-code.md` is the full handoff (priorities, acceptance criteria, known issues, unverified items). Read it first when picking up work.

## Commands

Run from the repository root.

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev server | `npm run dev` |
| Build / start | `npm run build`, `npm run start` |
| Lint | `npm run lint` |
| E2E tests | `npm run test:e2e` (`:headed` for a visible browser) |
| Typecheck | `npx tsc --noEmit` |

Environment variable names (values live in `.env.local` and the Vercel dashboard, never in Git): `MODEL_API_KEY`, `MODEL_PROVIDER` (`baseten` switches to Baseten Muse Spark Open; otherwise Meta), `BASETEN_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MODAL_OCR_URL`, `OCR_TOKEN` (the OCR token also lives in the Modal secret `da-ocr`).

## Stack

Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres, email/password auth, row-level security; anon key only, no service key), `pdfjs-dist` for PDF text, Playwright for E2E, Vercel free tier. Route `maxDuration`: 300 on audit, opportunities and policy-check; 120 on fixes.

Meta Model API: `https://api.meta.ai/v1`, POST `/v1/responses`, model `muse-spark-1.3` (never `-contributor`), `store:false`, `reasoning:{effort:"low"}`, `web_search` tool for lookups. Baseten uses `max_tokens` 30000.

## Architecture

```text
app/page.tsx              Upload, audit, policy check, saved audits
app/opportunities/        Funding, research, grad programs
app/gaps/page.tsx         Owner-only master list of policy discrepancies
app/api/audit|fixes|opportunities|policy-check/route.ts
app/api/ocr/route.ts     Scanned-PDF page images to the Modal OCR service (modal/ocr.py, tesseract)
lib/ocr.ts                Browser: renders scanned pages, sends them in batches
components/               Nav (sign-in, school, consent), Report, FixKit, OppCard, TermView
lib/audit.ts, rubric.ts   Audit pipeline and code-side grading
lib/verify.ts, sources.ts Quote verification, author bio check
lib/meta.ts, agent.ts     Model calls (Meta or Baseten), consistency agent
lib/fixes.ts              Student and instructor fixes per finding
lib/opps/                 Discovery, fit, ranking of opportunities
lib/policy/               types (topics), lookup (find and verify a school policy), compare (syllabus vs policy)
lib/cloud.ts, supabase.ts Saved audits, school policies, gap recording, gap report
db/schema.sql             Part 1 (audits, saved data)
db/002-policy-gaps.sql    Part 2 (school_policies, policy_gaps, app_owners, gap_report)
e2e/                      Playwright tests and fixtures
data/uo-policies/         400 UO web pages and 177 PDFs as text, each with Source URL and fetch date
docs/                     PRD, spec, spec audit, handoff
```

Flow: PDF or text, page-level extraction, model proposes passages and signal codes, code verifies each quote as an exact substring of the page (whitespace-normalized, ambiguous matches rejected) and grades, report shown.

## Grading rules (code decides, never the model)

- Per dimension: Strong needs P>=2 and N=0; Weak needs N>=2 and P=0; any other mix with at least one signal is Mixed; no signals with full coverage is Not found; no signals with partial coverage is Not assessed.
- Overall read needs at least 3 included dimensions: S = Strong - Weak; S>=2 inclusive leaning, S<=-2 old-guard leaning, otherwise mixed.
- Policy comparison: the model proposes a relation per topic (`matches`, `conflicts`, `adds_requirement`, `silent`). Code verifies the syllabus quote, the instructor name (must sit inside a verified quote) and silence (`TOPIC_WORDS`). Saved policies are re-fetched and re-verified on every use. UO policy pages must be on `uoregon.edu` (`SCHOOL_DOMAIN` in `lib/policy/lookup.ts`).

## Non-negotiables

- **$0 total, free-tier services only.** Credits may be spent to build and test, not wastefully. Set no paid plans.
- **Meta Model API is the analysis layer.** Never substitute another provider silently.
- **Citation verification is a display gate.** No finding, flag or grade is shown without a verified verbatim quote and locator. Drop unsupported findings; say `not found in this syllabus` for absent evidence.
- **Never infer identity; always infer stance from verified words.** A person's background is judged only from their own public bio (verified quote and link), never from a name, photo or reputation. The document's own words ARE judged directly — when the text supports it, name the framing plainly (colonial, punitive, progressive, exclusionary) instead of defaulting to "mixed." Not legal or academic advice. Policy-check entries are document-versus-document comparisons.
- Unreadable or image-only PDFs fail plainly (`could not read text from this file`). Never fabricate an audit from a file name.
- Contradictory policies keep both passages. Long documents are processed by section; disclose skipped sections.
- **Privacy.** Uploaded syllabi are not shared, published or used to train anything. Saved syllabus text is private to the student's account (row-level security). One exception (user decision 2026-10-27, disclosed on the upload page and in a required sign-up checkbox): where a syllabus differs from its school's written policy, the verified quotes, instructor name and school go to the private master list `policy_gaps` (no user id, SHA-256 syllabus fingerprint for dedupe, insert-only RLS, readable only by `app_owners` through `gap_report()`). Five distinct syllabi on one school and topic flag it. **Never make the list public without the user's say-so.**
- Known gap: a signed-in bad actor can insert fake rows with the anon key. Add a server route with a service key before any outreach.
- Keys are entered through the terminal prompt, never typed in chat or committed. `.env.local` and `private-demo/` stay out of Git.
- **Push to `main` only after explicit approval each time.**
- New work only. Scholarship HQ (Floot) must be rebuilt fresh with no code reused. Blindspot is shelved; do not apply its architecture here, though the policy check is the first Blindspot Engine-style algorithm.

## Conventions

- Smallest functional implementation; isolated reusable components; split complex files.
- Every API route, server action and data fetch has try/catch, a readable error log and a user-facing error state.
- Complete files or contextual diffs, no omitted-code placeholders. At a real technical fork, present two paths with brief pros and cons.
- Conventional commits: `type(scope): subject` under 50 characters, body wrapped at 72, ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Brand (DA Visual System V2 "Field Guide"): fonts Anton, Roboto Condensed, Roboto, Roboto Mono, Special Elite; pink light #F797C7, pink dark #D6006B, cyan dark #097771, violet light #BBA0EE; no lime text on paper; squarish corners; no gradients.
- The user dictates by voice and dislikes hedging, repeated caveats and moralizing. State findings plainly.

## Setup the owner still has to do (unconfirmed)

1. Run `db/002-policy-gaps.sql` once in the Supabase SQL editor.
2. Add the owner to `app_owners`: `insert into public.app_owners (user_id) select id from auth.users where email = '<owner email>';`.

## Gotchas

- The checkout is nested: `C:/Users/mabbi/dev/da-syllabus-auditor/da-syllabus-auditor`. Confirm the Git root with `git rev-parse --show-toplevel`.
- `private-demo/` (outside the repo) holds `GamesSyllabus2025_clean.pdf` (9 pages, the demo input) and the 19-note evaluation checklist. Never commit it, and never feed the notes into an audit as evidence.
- Known audit weaknesses: no check that stated grade weights sum to 100%; the "Mixed / unclear" label is redundant; the "Verified" stamp adds noise; "invited to let me know" accessibility wording is graded as supportive though the school routes students through the Accessible Education Center.
- Corpus gaps: 56 scanned PDFs, a 403 on the provost academic-policy-reminders page, moved catalog and AEC syllabus-statement pages, thin grade-appeal coverage.
