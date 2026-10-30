# Handoff: verify and land `feat/required-syllabus-contents`

Written 2026-10-27 by Muse Code (muse-wonder-1.0) at the owner's request. Read this first, then `docs/handoff-muse-code.md` (the main handoff; its sections 11 and 14 hold the master checklists — tick boxes there, not here, when work verifies).

## Where things stand (checked 2026-10-27)

- `main` is at `61ccc85` (`docs: record Vercel verification results`) and is pushed and in sync with `origin/main`. It contains: docs marked started/built (`71f9cd4`), UO domain-fix live test ticked (`bb4b620`), and Vercel audit + policy-check verification recorded (`61ccc85`).
- Current checkout is on `feat/required-syllabus-contents` at `621654f` (`feat: add required-contents check and three-service document workflow`), already pushed to `origin/feat/required-syllabus-contents`. That one commit (53 files, about +2,978 lines) adds: the required-syllabus-contents check (`lib/policy/contents.ts`, `contents-definitions.ts`, `contents-types.ts`, `components/RequiredContents.tsx`), local-corpus policy lookup (`lib/policy/corpus.ts`, handoff item 2), a shared policy check handler (`lib/policy/check-handler.ts`), unit tests (`lib/policy/*.test.mts`, `lib/meta.test.mts`, `lib/providers.test.mts`), E2E specs (`e2e/required-contents.spec.ts`, `e2e/provider-documents.spec.ts`), a Python `document_jobs/` OCR/download pipeline with tests (`tests/documents/`), provider setup docs (`docs/provider-document-setup.md`), and plans under `docs/superpowers/`.
- **None of that branch has been test-run in the session that wrote this file.** Typecheck passed on `main` before the branch was created; treat the branch as unverified until the steps below pass.
- Working tree: clean except one untracked file, `scripts/agent.code-workspace`. It is not part of this work; leave it alone (do not commit or delete it).
- Verified live on 2026-10-27 (details in `docs/handoff-muse-code.md` sections 3, 11 item 1, and 14): locally and on Vercel, the UO policy check returns all five topics with verified quotes on `uoregon.edu` pages; a synthetic 9-page audit on Vercel returns HTTP 200 in about 14 s with full coverage. One observed quality caveat: in one run the late-work policy quote was actually incomplete-grade text from the right page — verified words, wrong topic. Watch for that in the demo.

## Step 1 — verify the branch (do this first)

Run from the repo root `da-syllabus-auditor/da-syllabus-auditor`, on `feat/required-syllabus-contents`:

1. `npx tsc --noEmit` — must pass with no errors.
2. Unit tests added by the branch: `lib/policy/contents.test.mts`, `lib/policy/corpus.test.mts`, `lib/policy/check-handler.test.mts`, `lib/policy/reviewed-ocr.test.mts`, `lib/meta.test.mts`, `lib/providers.test.mts` (runner support in `test-support/register-typescript.mjs`; check `package.json` and the test files for the exact invocation the branch intends — do not invent a different runner and call it a pass).
3. Python tests: `tests/documents/` (`test_cli.py`, `test_download.py`, `test_extract.py`, `test_native.py`, `test_review.py`) with the project's Python setup; dependencies are listed in `document_jobs/requirements.txt` and `document_jobs/DEPENDENCIES.md`.
4. E2E: `npm run test:e2e` — at minimum the new `e2e/required-contents.spec.ts` and `e2e/provider-documents.spec.ts` must pass, and the existing `e2e/audit.spec.ts` must not regress. Meta API is mocked in E2E; a run that hits the paid API is the wrong run.
5. `npm run build` — must pass.

If anything fails: fix the smallest root cause on this branch, re-run the failing check, and record what failed and what fixed it in `docs/handoff-muse-code.md` section 12. Do not skip, deselect, or weaken a failing test to get green.

Done when: all five checks above pass on the same commit, and the results are ticked or noted in `docs/handoff-muse-code.md` (section 11 items 2 and 3, section 14 E2E item).

## Step 2 — land the branch (owner approval required)

- **Push and merge only after the owner's explicit approval each time.** That includes merging to `main`.
- On approval: merge `feat/required-syllabus-contents` into `main` (keep the branch commit history; do not squash away `621654f` without asking), re-run `npx tsc --noEmit` on merged `main`, then `git push origin main`.
- Git in this environment: the sandbox user cannot push (schannel has no GitHub credentials); pushing needs the escalated/owner shell. If a push is declined, leave the commit local and tell the owner the exact command: `git push origin main`.
- Conventional commits: `type(scope): subject` under 50 characters, body wrapped at 72, trailer `Co-Authored-By: <your model name> <noreply@anthropic.com>`. Stage files by name; never broad-add (the untracked `scripts/agent.code-workspace` must stay out).

## Step 3 — next feature: policy-versus-policy finder (handoff item 4)

Only after Steps 1–2, and only with the owner's go-ahead (it spends Meta credits; keep prompts short, reuse results):

- Read UO document pairs on the same topic from `data/uo-policies/` and report where they differ; each side needs a verified quote and source URL. Reuse the consistency-agent pattern in `lib/agent.ts` and the exact-substring gate in `lib/verify.ts`. Seed example: Provost "Syllabus Requirement" ("must be made available to students (hard copy or online as a downloadable document)" by the first day, revised 2/25/2025) versus the "Instructors with a syllabus created in Canvas do not need to create an additional downloadable syllabus" line — both quoted in `docs/handoff-muse-code.md` section 9. Re-verify both quotes against the fetched pages on the day; pages change.
- Model proposes, code verifies and decides. Unverified quotes are dropped, never shown. This finder needs no uploads, so it can be demoed immediately.

## Still open in the main handoff (section 14; owner actions)

- [ ] Run `db/002-policy-gaps.sql` once in Supabase and add the owner to `app_owners` (SQL in section 8 of the main handoff).
- [ ] Confirm the Meta billing spend limit is set.
- [ ] Confirm the GitHub Actions E2E workflow passes.
- [ ] Sign-in on Vercel; timing with the real 9-page demo PDF in the browser.
- Demo script starts around Oct 30 (main handoff item 11). Submission due Nov 4, 2026, 9 PM ET.

## Hard rules that bite here

- `$0` budget, free tiers only. Never use `muse-spark-1.3-contributor`; Meta calls use `store: false` and low reasoning effort via `lib/meta.ts`.
- Never print, log, or commit keys. `.env.local` values stay out of git and chat; the owner enters secrets themselves.
- `../private-demo/` (outside the repo) holds the owner's real syllabus and 19-note answer key. Never commit, copy, or feed the notes to any audit, test, or model call.
- Every API route and fetch keeps try/catch, a readable log, and a user-facing error state. One run-to-run variance is known: a single dropped topic is variance, not proof — re-run once before concluding (see main handoff section 12).
- The sandbox cannot open new listening ports (EACCES) and cannot reach `localhost:3000`; something already listens on port 3000 — do not kill processes you did not start. For live checks, use the deployed Vercel API (`https://da-syllabus-auditor-hkrr.vercel.app`) or an owner-shell local prod server (`npx next start -p <free port>`, POST, then kill only that process tree).
- Absent topic means `not found in this syllabus`, never a low grade. Identity is never inferred (author background only from their own verified public bio); stance IS inferred from the subject's own verified words, named plainly rather than hedged (owner decision 2026-10-30 — see AGENTS.md).
