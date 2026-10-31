# Handoff for Muse Code: DA Syllabus Auditor

Written 2026-10-27 for an AI coding assistant that will continue this project with the owner. Read this file first, then `CLAUDE.md`, then the files listed under "Where things are". `CLAUDE.md` was brought up to date on 2026-10-27 and agrees with this file. Still-applicable guidance from this file was merged into `AGENTS.md` on 2026-10-27. Everything here was checked against the repository on 2026-10-27 unless marked **unverified**. Tick the `- [ ]` boxes below as each item is verified or done; leave a box unticked until you have seen the evidence yourself.

## 1. What this is, in one paragraph

DA Syllabus Auditor is a Next.js web app for the Meta Global AI Developer Hackathon. A student uploads a syllabus PDF; the app grades it on five dimensions and flags attendance, grade-weight and late-work risks. Every finding is backed by a quote that the code has checked is word-for-word in the document. The project began as a single-syllabus audit and has grown, at the owner's direction, in two ways: (a) a dashboard for non-traditional and low-income students (funding search, fixes for each finding), and (b) as of 2026-10-27, the owner's chosen main aim: **an accountability record that compares syllabi to the University of Oregon's own written policies and keeps a private master list of where they differ.** The owner calls this the real aim of the app for the hackathon, and the first step toward a larger "Blindspot Engine" idea (compare documents an institution produces against standards the institution itself wrote, using verified quotes). Blindspot itself is shelved; do not build its old architecture.

The owner's motto: tools that only point out problems and give no solutions are not acceptable. Each finding should lead to something the student can do.

## 2. Deadlines and judging

- Submission due **Nov 4, 2026, 9 PM ET (7 PM MT)**. Needs a public GitHub repo, a 3-minute demo video, and use of Meta models. The repo is `Mabbit143/da-syllabus-auditor`, branch `main`.
- Judging weights: Impact 30%, Meta tooling 25%, Demo 25%, Technical 20%.
- Only new work built during the hackathon counts. Scholarship HQ (the owner's earlier app on Floot) must not be reused; the funding module here was rebuilt fresh.
- Budget: **$0, free tiers only.** Meta credits ($150 granted, card on file) may be spent to build and test, but not wastefully. Use the standard model `muse-spark-1.3`, never the `-contributor` variant. A Billing Spend Limit should be set in the Meta console (**unverified** whether the owner did this).

## 3. Live system

- Deployed on Vercel free tier: https://da-syllabus-auditor-hkrr.vercel.app (public; Deployment Protection was turned off). The long per-deployment URL is login-walled; always use the short one.
- Verified 2026-10-27: the site loads and `/api/audit` returned a real report in 6 seconds for a one-page test syllabus. Also verified 2026-10-27 on Vercel: a synthetic 9-page audit (HTTP 200, 14 s, full coverage) and the UO policy check (HTTP 200, 23 s, 5 of 5 topics on `uoregon.edu`); see section 14. **Not verified on Vercel:** sign-in, and timing with the real 9-page demo PDF in the browser (about 54 s locally on Meta, about 75 s on Baseten). Routes set `maxDuration = 300` (audit, opportunities, policy-check) and 120 (fixes).
- Supabase (free tier): Postgres, email/password auth, row-level security. The redirect URLs include the Vercel address (the owner confirmed doing this).
- Git state when this was written: `main` is **2 commits ahead of `origin/main`** (`8ee6923` policy check, `d3a9e8c` UO corpus) plus an uncommitted edit to `lib/policy/lookup.ts` (the UO domain fix, section 9). The owner pushes only after explicit approval each time.
  - Update 2026-10-27 (checked against the repo): the UO domain fix is now committed as `14ace8b` (`fix(policy): require the school's own site for UO`), the handoff and `CLAUDE.md` updates are committed (`6de34ad`, `cc7ff88`, `e039968`), and the working tree is clean. Tick item 1 in section 11 only after the live lookup test passes; the commit alone is not the test.

## 4. Commands

Run from the repo root (`da-syllabus-auditor/da-syllabus-auditor`; the parent folder is not the git root).

| Task | Command | Status |
| --- | --- | --- |
| Dev server | `npm run dev` (port 3000) | works |
| Typecheck | `npx tsc --noEmit` | passes as of 2026-10-27 |
| Lint | `npm run lint` | not run recently |
| E2E tests | `npm run test:e2e` | 10 tests, Meta API mocked; all 10 passed locally 2026-10-27 on `621654f`. GitHub Actions workflow `.github/workflows/e2e.yml` has never been confirmed green |
| Build | `npm run build` | not run in this session |

## 5. Environment variables (names only; values live in `.env.local`, which is gitignored)

- `MODEL_API_KEY`: Meta Model API key (base URL `https://api.meta.ai/v1`, POST `/v1/responses`, model `muse-spark-1.3`).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public publishable values. No Supabase service key is used anywhere.
- `BASETEN_API_KEY` and `MODEL_PROVIDER=baseten`: optional. Baseten serves Muse Spark Open (`meta-models/muse-spark-open-1026`) at `https://inference.baseten.co/v1/chat/completions`. It always reasons and needs `max_tokens` 30000. It is off by default. Web search always stays on Meta.

Never print, log or commit keys. The owner enters secrets through a hidden terminal prompt, never in chat. `private-demo/` (outside the repo) holds the owner's real syllabus and answer key and must never be copied into the repo.

## 6. Non-negotiable rules (also in `CLAUDE.md`)

1. **Evidence gate.** Every displayed finding needs a quote that is an exact substring of the page text (only whitespace is normalized, ambiguous matches are rejected). Model-supplied quotes alone are never trusted. Dropped findings are dropped silently; absence is shown as "not found in this syllabus".
2. **Grading is done in code, never by the model.** The model proposes passages with signal codes; `lib/rubric.ts` grades. Rubric: Strong needs P>=2 and N=0; Weak needs N>=2 and P=0; any other mix with at least one signal is Mixed; none with full coverage is Not found; none with partial coverage is Not assessed. Overall read (needs at least 3 included dimensions): S = Strong - Weak; S>=2 inclusive leaning, S<=-2 old-guard leaning, otherwise mixed.
3. **Never infer identity; always infer stance from verified words.** (Owner decision, 2026-10-30 — supersedes the earlier "intent and identity are never inferred" rule.) A person's background is judged only from their own public bio (verified quote and link), never from a name, photo or reputation — that anti-bias check is unchanged. What changed: the app now judges intent and stance directly from a document's own verified words, including at department level across its public curriculum documents. When the text supports it, name the framing plainly — colonial, punitive, progressive, exclusionary — instead of hedging into "mixed." The owner's own words: "I absolutely mean to infer intent from a person's words... I want them held accountable."
4. **Describe what documents show.** No legal or academic advice. The owner has said, with some force, that they are not asking for judgments about whether a person is good or bad; they are building case-by-case evidence of how the *way a person operates inside school rules* departs from the school's written rules, and they do want instructors named. Record the document-versus-document comparison, both quotes, and the name. Do not add moralizing caveats about this.
5. **Unreadable PDFs fail plainly** ("could not read text from this file"); never audit from a file name.
6. **Privacy.** Syllabi are not shared or used to train anything, with one disclosed exception (section 8). Saved audits are private to the signed-in student by row-level security.
7. **Fee rule (funding):** listings that charge a fee or need a membership are dropped.
8. **Secrets stay out of git.** `.env*`, `private-demo/`, `test-results/`, `playwright-report/` are ignored.
9. **Coding style from the owner:** smallest functional change, complete files or contextual diffs, explicit try/catch on every route and fetch with readable logs and user-facing error states, conventional commits (type(scope), subject under 50 characters, body wrapped at 72) ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (use your own model line if you commit).

## 7. Where things are

Audit core
- `lib/types.ts`: report types. `lib/rubric.ts`: signal table, grading, risk-flag severity. `lib/verify.ts`: `verifyQuote`. `lib/audit.ts`: `runAudit` (extraction, author lookups and conflict finding run concurrently; JSON retried up to 3 times). `lib/meta.ts`: `callMeta`, `callMetaSearch` (Meta Responses API with `store:false`, `reasoning:{effort:"low"}`, `web_search` tool), `runAgent`, Baseten functions. `lib/sources.ts`: author bio checks, `squash`, `isPublicHttp`, `pageText`. `lib/agent.ts`: the consistency agent (tools `find_text`, `read_page`, `report_conflict`). `lib/extract.ts`: PDF text in the browser with pdfjs.
- `app/api/audit/route.ts`; `app/page.tsx`; `components/Report.tsx`, `TermView.tsx`.

Fixes (a solution for each finding)
- `lib/fixes.ts`, `app/api/fixes/route.ts`, `components/FixKit.tsx`: questions to ask, a message to send, and clearer wording. The rewrite's "original" must sit inside one quote, and the prompt forbids facts about the student.

Funding module
- `lib/opps/` (`types.ts`, `discover.ts`, `rank.ts`, `fit.ts`), `app/api/opportunities/route.ts`, `app/opportunities/page.tsx`, `components/OppCard.tsx`. Ranking is done in code: hard filters, then expected value (amount x (1 + 0.25 x targeting count)), crunch-week deadlines sink. Known gap: school-limited emergency funds with no stated amount rank last.

Accounts and storage
- `lib/supabase.ts`, `lib/cloud.ts` (profile, saved listings, audits, plus the policy cache, gap recording and the owner report), `components/Nav.tsx` (`AuthBox`, `useUserId`, `useSchool`), `db/schema.sql`, `db/002-policy-gaps.sql`.

Policy check (new, commit `8ee6923`)
- `lib/policy/types.ts`: topics (`accommodations`, `late_work`, `attendance`, `academic_integrity`, `incompletes`), relations (`matches`, `conflicts`, `adds_requirement`, `silent`), `TOPIC_WORDS` (code, not the model, decides a syllabus is silent: none of the topic's words may appear in it).
- `lib/policy/lookup.ts`: model-assisted search for a school's policy, then the page is fetched and the quote verified; saved policies are re-fetched and re-verified every time, so a tampered database row is ignored. Pages must be on `.edu`.
- `lib/policy/compare.ts`: model proposes a relation and a syllabus quote per topic; code verifies the quote, the instructor name (the name must appear inside a verified quote), and silence.
- `app/api/policy-check/route.ts`, the "Against your school's own policies" section in `components/Report.tsx`, and `app/gaps/page.tsx` (owner-only list).

Reference data
- `data/uo-policies/`: the University of Oregon policy corpus (section 10).

Brand and tests
- `app/globals.css`, `app/layout.tsx`. `e2e/audit.spec.ts` and `e2e/fixtures/`. `playwright.config.ts`.

Docs
- `docs/prd-da-syllabus-auditor.md` (original PRD), `docs/spec-da-syllabus-auditor-v1.md` (current spec: scope expansion, opportunity dashboard, grading rules, source authorship check, blocking decisions), `docs/spec-v1-audit.md`.

## 8. The master list ("policy gaps") and the consent decision

Decided by the owner on 2026-10-27:

- Every time a signed-in student audits a syllabus and it differs from their school's written policy, a row goes to a shared table `policy_gaps`: school, topic, kind (`conflicts`, `adds_requirement`, `silent`), instructor name, the syllabus quote and page, the school's quote and URL, and a one-way SHA-256 fingerprint of the syllabus text. **No user id is stored.** The fingerprint only keeps one syllabus from counting twice.
- When 5 distinct syllabi from one school share a discrepancy on one topic, `gap_report()` marks the group flagged. The threshold is a parameter of that function (the page passes 5).
- The list is **private for now**. The owner does not want it public: publicity would make some people avoid the app and others join to game it. Never expose it without the owner's say-so.
- Because the upload text says syllabi stay private, the owner required honest disclosure: the sign-up form has a required consent checkbox and a school field, and the upload text states what is recorded. Do not remove or soften either.
- Security model: signed-in users can insert but there is no select policy, so rows cannot be read back by the app's users. Reading goes through `gap_report()`, a security-definer function that only works for ids in `app_owners`. **Known weakness:** with the public anon key, a signed-in bad actor could insert fake rows. Before any school is contacted, move inserts behind a server route that uses a server-only Supabase service key (secret in Vercel only) and re-verify the quotes server side. Until then, treat the list as leads to check against the quoted pages, not as proof.
- `school_policies` (cache per school, readable and writable by signed-in users) is safe only because every row is re-verified against its page on use.

**Setup the owner still has to do in Supabase (unverified whether done):**
- [x] 1. Run `db/schema.sql` once (done earlier).
- [x] 2. Run `db/002-policy-gaps.sql` once (owner confirmed 2026-10-27, section 14).
- [x] 3. Add the owner to `app_owners` (owner confirmed 2026-10-27, section 14) in the SQL editor: `insert into public.app_owners (user_id) select id from auth.users where email = '<owner email>';` (the email is deliberately not in the repo).
- [x] 4. In the app (owner signed up on the live site and was asked for a school, 2026-10-28): the school field is stored in the auth user's metadata at sign-up; an account created before this change shows a "Which school are you at?" box on the home page.

## 9. University of Oregon focus (decided 2026-10-27)

The owner attends UO (3 to 4 semesters of Canvas syllabi) and wants the whole effort UO-first, because one school makes the 5-syllabus flag reachable, and because "build your own world" and being concretely involved is part of the hackathon brief. Findings may or may not be taken to UO later.

Done and committed in `14ace8b`: `lib/policy/lookup.ts` now rejects a policy page unless it is on `uoregon.edu` (for the school "University of Oregon") or, for other schools, names the school's full name. This fixes a real risk: Oregon State pages contain the word "Oregon" and passed the old word check. A domain map `SCHOOL_DOMAIN` holds known schools; add more as schools are added. Typecheck passes. Tested against the live lookup 2026-10-27: see item 1 in section 11.

Findings so far from reading UO's own pages (all from public pages; quotes verified against fetched pages on 2026-10-27, so re-verify before using in the demo):
- Provost "Syllabus Requirement" policy (undergraduate, revised 2/25/2025): the syllabus "must be made available to students (hard copy or online as a downloadable document)" by the first day of class, and also: "Instructors with a syllabus created in Canvas do not need to create an additional downloadable syllabus." UO's teaching site says the same about Canvas pages. These two lines are the owner's first example of UO's pages not lining up cleanly, and a model for the planned "policy versus policy" finder.
- The Provost asked that syllabi for all classes be fully digitally accessible starting Fall 2026 (teaching.uoregon.edu guidance, updated 2026-09-04).
- The owner's current instructor (the same one who taught the "Games and Culture" syllabus that started this project) has no downloadable syllabus this term; the syllabus is scattered across Canvas pieces. Whether scattered pieces satisfy "a syllabus" is a fair question the policy text does not answer. Present it as what the pages show.
- The owner's account of how AEC works (students go to the Accessible Education Center, and the center, not the instructor, handles the documented disability) is their lived experience and **unverified** against UO's pages. The "adds_requirement" relation exists to catch syllabi that send students to the instructor instead.

## 10. The UO policy corpus (`data/uo-policies/`, commit `d3a9e8c`)

- 400 web pages (`NNN-<site>-<path>.md`) and 177 PDFs (`pdf/`). Each file begins with title, `Source:` URL, and fetch date. `_index.json` in each folder lists everything, plus failures and unread links.
- Sites: provost, registrar, policies library, AEC, teaching, digital accessibility, Dean of Students, conduct, Title IX investigations, financial aid, Canvas, advising and others.
- Coverage by topic (files mentioning it): accessible education 64, syllabus 76, attendance 46, Title IX 47, withdraw 54, incomplete 36, final exam 20, student grievance 13, academic misconduct 12, dead week 7. Dedicated pages exist for incompletes, dead week, final exams, religious observance accommodations, student grievance, University Course Policies, AEC concerns and grievances, and the Course Attendance and Engagement policy (PDF).
- **Not covered:** 56 PDFs are scans with no text layer (need OCR); the Provost "Academic Policy Reminders" page returned 403 (not bypassed; the owner can save it by hand); the catalog's academic regulations and the AEC `syllabus-statement` page moved (old URLs 404, find the new ones); grade-appeal procedure is thin (3 files); the crawl stopped at its 400-page cap with about 8,000 links unvisited, mostly employee and administrative policy; about 30 files are Policy Advisory Council meeting agendas (noise).
- The crawler and PDF reader were one-off scripts (Node `fetch`, then `pdfjs-dist`), run politely at 4 requests at a time, same-site only, and are not in the repo. Rebuild them if the corpus must be refreshed.
- Nothing here has been read word-for-word by a person or a model; it is collected as the reference set.

## 11. Prioritized work, with what "done" looks like

- [x] 1. **Commit and test the UO domain fix.** Commit done in `14ace8b`; live test passed 2026-10-27 (local prod server, `POST /api/policy-check`, school "University of Oregon"): all five topics returned verified quotes on `uoregon.edu` subdomains (`aec`, `provost`, `policies`). Note the variance: a first run the same day returned only 4 of 5 (academic integrity dropped), so treat single-run drops as variance, not proof. Still open: the same check on Vercel (section 14). Done when the policy check run against "University of Oregon" returns verified quotes for at least accommodations, late work, attendance, academic integrity and incompletes, all on `uoregon.edu` pages. Check the dropped-reason logs (`[policy] ... dropped`).
- [x] 2. **Use the local corpus as the primary reference for UO** instead of live web search. Implemented locally 2026-10-27: `lib/policy/corpus.ts` uses reviewed passage locators for all five existing topics, verifies exact text against the committed source body, and preserves the UO source URL. The route loads these before cached policies; missing topics retain the existing verified web fallback, as do other schools. Next.js tracing includes the corpus in the server deployment. Verified: two offline corpus tests (all five topics, exact quotes and source URLs, school routing), TypeScript, changed-file lint, and production build. No model calls used. Full-repo lint still fails with eight existing errors in unrelated files. Deployment and live browser verification remain open. These are 2026-10-27 snapshots, not re-verification of current live wording; re-fetch demo quotes on demo day.
- [x] 3. **Add topics.** Ten UO policy topics now (five added 2026-10-28, `097f0ef`; live check 34 to 45 s with two models). Required syllabus contents implemented locally under the owner-approved design `docs/superpowers/specs/2026-10-27-required-syllabus-contents-design.md`: eight groups with separate component evidence, course context, historical applicability, source snapshot labels, fixed next-step questions, printable evidence, and no automatic gap insertion. Verified 2026-10-27: 20 Node tests, all 9 mocked browser tests (5 existing + 4 new), TypeScript, changed-file lint, and production build. Independent review completed; all five important findings fixed with regressions. Two minor follow-ups and unverified live checks are recorded in `docs/superpowers/required-contents-review.md`. Branch `feat/required-syllabus-contents` (`621654f`) re-verified 2026-10-27: `tsc --noEmit` clean, 28 native Node tests (`node --test lib/policy/*.test.mts lib/meta.test.mts lib/providers.test.mts`), 20 Python tests (`python -m unittest discover -s tests/documents`), `npm run build`, and all 10 E2E tests pass. Deployment and live model verification remain open. Withdrawal and drop-deadline added 2026-10-29 (`lib/policy/corpus.ts`, source: registrar add/drop page), rounding out eleven topics. All topics named in this item's original to-do are now present; "grade appeals" is covered under the existing `grievances` topic, not a separate one — corpus coverage there is still thin (see Known limits in README). Verified 2026-10-29: `node --test lib/policy/*.test.mts` (35/35, including the new eleven-topic snapshot test), `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` (14/15; the one `ocr.spec.ts` failure reproduced as a pass on retry — known flake, not a regression), changed-file lint clean. Deployment and live model verification remain open.
- [x] 4. **Policy-versus-policy finder.** Built and merged in `8aa31f6` (`/policies`, `/api/policy-pairs`, `lib/policy/pairs.ts`); unit test passes. Live model run on Vercel not yet verified. Read pairs of UO documents on the same topic and report where they differ, each side with a verified quote and URL. Needs no uploads, so it can be demoed immediately. Use the existing consistency agent pattern (`lib/agent.ts`). The Provost-versus-teaching-site "downloadable" wording is the seed example.
- [x] 5. **"Who do I go to" navigator.** Built 2026-10-28 (`/navigator`, `/api/navigator`, `lib/policy/navigator.ts`, `f125d3a`); five situations, quotes verified in code, second model marks single-model offices; live-checked on both models. Owner still to confirm the five answers against UO pages. For situations (need an accommodation, dispute a grade, report harassment, instructor does not follow policy), show the office each UO page names, the page that says so, where pages name different offices or none, and a ready-to-send message. This is the solution half of the owner's motto.
- [ ] 6. **Canvas-style syllabi.** The audit takes one PDF. Add input for pasted text or several files merged into one audit, with each piece labeled by where it came from, so a syllabus scattered across Canvas pages can be audited and the scattering itself reported. The owner's current course is the first test.
- [x] 7. **Owner "Schools" page.** Done 2026-10-28 (`de73ff1`): by-instructor view, distinct-syllabus counts, "not yet flagged" label. Real data comes from the owner running 3 to 5 syllabi. Original note: `app/gaps/page.tsx` exists (flag at 5, evidence list with instructor and both quotes). Polish it, add a per-instructor view and a count of distinct syllabi, and keep it owner-only.
- [ ] 8. **Server-side gap insertion** with a service key (section 8) before any outreach to a school.
- [ ] 9. **Persist verified listings** across funding searches so repeat searches agree; decide how to treat emergency funds with no stated amount (pin them or give emergency funding its own section).
- [ ] 10. **Research and grad-program planner** (professors and open assistantships). Lower priority now that the accountability record is the main aim.
- [ ] 11. **Demo.** Start the script around Oct 30. Suggested arc: upload the owner's real syllabus, show the verified findings, show the side-by-side with UO's own policy, show the "UO against itself" finding, show the "who do I go to" answer and the drafted message, then the owner-only Schools page with counts. Be honest on camera about sample size (real numbers, from the owner's own syllabi and any friends' syllabi who consent).

## 12. Known issues and caveats

- **Sign-out cleanup (2026-10-31): implementation verified locally; production check pending.** The owner reported that loaded syllabi remained visible after sign-out. `AuditorHome` kept React state and the shared browser cache, which could also be imported into a different empty account. The browser Supabase singleton now clears only `da-syllabus-auditor.*` storage and replaces the page on sign-out or a change away from an active account; cloud-saved audits are untouched. A new browser regression first reproduced the visible-report leak, then passed with the fix. Verified locally: 90 Node tests, all 18 browser tests (including account-switch isolation, cross-tab logout, and logout-server failure), TypeScript, lint (existing warnings only), and production build. Playwright uses mock Supabase settings and intercepted auth/database requests, so CI needs no real account secrets. A Windows build initially failed with `VirtualAlloc failed`; rerunning with `NODE_OPTIONS=--max-old-space-size=1024` succeeded. The owner approved committing and pushing this fix in chat. Still required: verify sign-out cleanup on the deployed site.
- Run-to-run variance: grades, search results and whether the consistency agent finds conflicts can differ between runs of the same file. The owner's real syllabus once showed "mixed, 5 of 5 dimensions, 0 risks"; the owner believes some risks (and grade weights that do not add up) are missed. Two concrete gaps found: nothing sums stated grade weights to check they reach 100%, and "invited to let me know" language is graded as supportive even where the school routes students through AEC.
- Labels: "Mixed / unclear" is redundant (the owner dislikes it); show "Mixed" with the counts. The "Verified" stamp on every quote is noise on a single-document report; keep the "See in context" link.
- Author-bio checks rarely produce signals, so the "whose perspectives" dimension is weak by design.
- Funding search takes 1 to 2.5 minutes. Mobile layout and the term view and fixes UI are only partly checked in a browser.
- Browser-pane `innerText` is uppercase for CSS-uppercased buttons; use case-insensitive regexes in test scripts.
- Python tests need `pypdfium2` and `Pillow` (`document_jobs/requirements.txt`); without them 7 of 20 tests error with `ModuleNotFoundError`. `modal` is not needed to run them.
- Python edit scripts have failed silently before. After any scripted edit, check with `git diff` and `git status`.

## 13. How the owner works (important)

- **Ask before big steps.** Earlier the assistant coded and called the paid API before kickoff and was stopped; the rule is now: do not start expansions or spend credits wastefully without the owner's go-ahead, and **push to `main` only after explicit approval each time.** Committing locally after being asked is fine.
- The owner dictates by voice, so messages are long, informal and sometimes mis-transcribed. They are direct, get frustrated by hedging and repeated caveats, and want plain language and a concrete next step. Answer first, then only what they need to act on.
- They create accounts and enter keys themselves. Keep any credential entry in their hands.
- Brand: DA Visual System V2 "Field Guide": six colors plus contrast registers (pink light #F797C7, pink dark #D6006B, cyan dark #097771, violet light #BBA0EE). No lime text on paper, violet on black uses #BBA0EE, squarish corners, no gradients. Fonts: Anton (display), Roboto Condensed (labels), Roboto (body), Roboto Mono (metadata), Special Elite (typed quotes). Reference file on the owner's machine: `C:\Users\mabbi\Documents\Mabbitopia\RookeryBrain\06_Assets_And_Brand\Brand System\DA-Design-Quick-Reference.md`. The owner has twice corrected a wrong palette; read that file before styling anything.
- Good model for new work: model proposes, code verifies and decides. That is what keeps the evidence gate honest and is itself part of the pitch.

## 14. Unverified items to confirm early

- [x] The 300-second function limit on Vercel's free plan, and a full audit plus policy check running on the live site. Verified 2026-10-27 against the live API: 9-page audit HTTP 200 in 14 s (full coverage, overall "mixed" on 5 of 5, 24 verified passages) and UO policy check HTTP 200 in 23 s (5 of 5 topics on `uoregon.edu`). Both are synthetic test syllabi and finish far under 300 s, so the cap itself is not stressed; still confirm timing with the real 9-page demo PDF in the browser before the demo.
- [x] `db/002-policy-gaps.sql` run and owner added to `app_owners` (owner confirmed 2026-10-27).
- [x] Meta billing spend limit set (owner confirmed 2026-10-27).
- [x] GitHub Actions E2E workflow passes (green on `main`, run 40617882009, 2026-10-28).
- [ ] UO policy wording used in the demo: re-fetch and re-quote it on the day, since pages change.
