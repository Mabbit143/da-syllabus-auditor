# November 2, 2026 readiness gate

Owner deadline: **November 2, 2026**. This is the owner's app-readiness deadline, not a claim about a changed hackathon submission date.

Status: **not yet release-accepted**. Work in progress on October 31. A passing mocked suite is not proof of repeat-run agreement or deployed account isolation.

**Update 2026-11-01 — evidence packet for demo (t_4e488b29):** `docs/demo-evidence-packet.md` created and verified offline without private-demo access or model credits. It anchors the demo script with verified UO policy quotes (11 topics, `data/uo-policies/*.md` + 5 selected reviewed-OCR records, `corpus/evidence` tests), 8-group required-contents locators, dimension/risk rubric (`lib/rubric.ts`/`lib/audit.ts` code grading), and intercepted-route Playwright evidence. Verified: `npx tsc --noEmit` ✓, `npm run build` ✓, `node --test` 211/211 ✓, `npm run test:e2e -- --workers=2` 36/36 ✓. Handoff §11 item 11 marked done for evidence selection; script/video recording and live 9-page audit re-fetch remain open (see packet §6–8).

## Work coordinated in the desktop readiness session

Baseline inspected: local `main` at `5b26d3441607a52fc520fa16c9b05bfa55e51eb4`, initially clean. The required-contents, evidence-ledger and UO crunch-map feature branches have no unique commits relative to that local main. Existing Kanban workers retain ownership of their active tasks; this session must not duplicate or overwrite them.

| Area | Local work / evidence | Acceptance still required |
|---|---|---|
| Attendance | Fix direct prose grade-share contradiction, negated/non-graded attendance, and preserve actual fail/drop clauses. Core child owns audit/ledger. | Targeted real-function regressions, combined offline suite, then an approved controlled live run. |
| Schedule | Reject arbitrary fallback week placement unsupported by its quote when no recognized schedule exists; retain a coverage explanation. | Positive explicit-week cases and unsupported/no-schedule cases, full verification. |
| Required grading criteria | Reproduced a genuine `Midterm   100   50%` quote incorrectly marked as assessment criteria. Added guard: insufficient criteria support is `needs_review`, with exact quotation retained. | Targeted suite passed 12/12 and changed-file eslint passed; combined candidate verification remains open. This is a bounded gate, not general semantic proof. |
| Schools page instructor view | Reproduced: the instructor view copied the school-wide flag (5+ syllabi across all instructors), so an instructor with one syllabus showed `FLAGGED`. Field renamed `schoolGroupFlagged`; page now reads "N syllabus from this instructor · school-wide group FLAGGED / not yet flagged". RED observed, then `lib/gaps.test.mts` 3/3 and changed-file eslint pass. | Owner-session check against real saved rows (see t_c08e5f23). |
| Python document pipeline | Restored. Verified by parent: `env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m unittest discover -s tests/documents` ran 20 tests, OK; `pip check` clean; `.document-venv/` is git-ignored. Plain `python` can pick Hermes's interpreter — use the documented command (`docs/python-document-tests.md`). | None for this item; card t_1239f8b5 closed. |
| Combined-piece provenance | Add accurate piece labels at quote locators, preserve actual original logical-page metadata for new inputs, and do not invent local pages for legacy records. | Unit checks, saved-report compatibility, mocked browser and print checks across report sections. |
| Department rollups | Existing Kanban worker `t_3b7a8644` owns combined-course identifiers and department evidence scoping. | Read and review that worker's resulting code/tests, then verify the combined candidate. |
| Production security | Existing task reports unauthenticated API/RPC denial and Production service-key configuration. | Authenticated permitted route write, direct-client insert denial, owner/non-owner read isolation and controlled-fixture cleanup remain unverified; sign-in access required. |
| Real Canvas acceptance | Supplied report review exists; original retained two-piece text was not available to that review. | Exact source-span and piece-origin verification against those same original inputs; no request to find additional course material. |
| Live semantic review | Existing clean-demo run is recorded by its Kanban worker; source-supported attendance/policy interpretation defects remain. | Incorporate final review findings. Do not treat quote containment, model agreement, or speed as proof of semantic correctness. |

## Verified local checkpoint — October 31, 2026

The interrupted core/provenance workers' partial files were inspected rather than presumed finished. Parent verified the combined working tree:

- Native Node suite: **176 passed, 0 failed, 0 skipped** (`MODEL_API_KEY= BASETEN_API_KEY= node --test lib/*.test.mts lib/policy/*.test.mts`). This includes the separate record-gaps worker's local changes; those changes remain that worker's ownership.
- Typecheck: `npx tsc --noEmit` passed.
- Full mocked browser suite: **24/24 passed** with `NODE_OPTIONS=--max-old-space-size=1024 MODEL_API_KEY= BASETEN_API_KEY= npm run test:e2e -- --workers=2`. Added source-provenance checks exercise new and legacy saved records, correct context highlighting, policy/contents/fix locators, print, reload without reanalysis calls, and failed combined-input retry with inputs retained. First run was 23/24 because a test's unscoped `role=alert` matched Next's route announcer as well as the real error; scoping the assertion to the actual main error paragraph fixed the test, without changing production behavior or skipping it.
- Explicit `npm run build` passed with bounded Node memory. `npm run lint` exited 0 with eight pre-existing unused-variable warnings (six are copies in `.claude/worktrees`). Changed-file source/provenance lint passed after removing an unused test destructuring variable.
- `git diff --check` passed. Git emitted line-ending notices, not whitespace errors.
- Project-local Python document suite independently passed **20/20**, with `pip check` clean.

These are offline results, **not** proof of fresh live-model repeatability, production OCR accuracy, authenticated owner/non-owner controls, or deployment of the local fixes. No commits, pushes, deployment, or paid calls were made by this readiness session.

Core implementation now covers the demonstrated prose attendance share/no-figure contradiction, negated attendance-grading proposals, stated fail/drop clauses, distinct lecture/lab shares, unresolved conflicting shares, and unsupported fallback-week rejection. These gates are deliberately bounded; an independent adversarial review is still in progress. Remaining planning items (semantic policy-relation support, full private version/diff design, stable handling of model-only signal recall) are not claimed implemented.

Department grouping/evidence work did not finish in its original worker: gateway crashes left its isolated implementation in task `t_3b7a8644`'s workspace. A recovery child is reviewing and integrating only that slice; combined verification must be repeated after it changes main. The full release gate below remains open.

Browser access check: `local=true` still returned a locked-profile warning and a fresh signed-out session at `/gaps`. This establishes only the session available to automation; it does not prove the owner's Edge account is signed out or that app sign-in itself is broken. No browsers were closed.

## Release criteria

- [ ] Narrow bug fixes reviewed against source-support counterexamples, with no rubric/count/threshold changes.
- [ ] Same-input proposal-order and semantic validation holes addressed under an explicitly approved tie/claim-span contract; model recall limits remain disclosed.
- [ ] Saved historical result opening is distinguished from explicit fresh reanalysis; private version/source/provider changes remain visible. No public or cross-account cache and no freezing an inaccurate first result to conceal variance.
- [ ] Full native Node test suite passes on the combined candidate, with exact counts recorded.
- [ ] Python document suite passes in a documented project-local environment.
- [ ] Typecheck, full lint and production build pass; warnings and environmental retries are recorded honestly.
- [ ] Full mocked Playwright suite passes at `--workers=2`, including sign-out/account switching, merged inputs, provenance, department evidence and packet failure/retry tests.
- [ ] Source-syllabus identity and controlled live-test call/credit cap approved before metered tests; configured provider and remaining budget checked without exposing secrets.
- [ ] Live repeat-run sample and actual document review substantiate any claimed conclusion stability. Missing evidence, partial stages and unsupported policy relations do not receive confident findings.
- [ ] Authenticated production access controls and gap-recording behavior verified with independent read-back and cleanup.
- [ ] Every promised production path (including configured scan/OCR behavior) tested or plainly declared unavailable. No invented output from unreadable input.
- [ ] Exact release candidate approved for commit/push/merge/deployment, deployed, and smoke-tested on that revision. Local fixes alone do not change the live app.

## Boundaries

This readiness request authorizes bounded local implementation and offline verification. It does not override the repo's explicit approval gates for paid model calls, commits/pushes, merge/deploy, rubric redesign, or publishing/sending source documents or accountability letters. Keep the owner-only policy-gap list private. Never access answer-key notes or copy `private-demo` into the repo/tests/attachments.

Coordinate shared `next build`/Playwright webServer use: one verifier at a time. Other workers' changes must not be reset, stashed or silently restored. After all contributors finish, capture the exact diff, run the full verification chain, and update this file with real outputs before calling the candidate ready.
