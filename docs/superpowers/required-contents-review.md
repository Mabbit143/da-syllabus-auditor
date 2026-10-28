# Required syllabus contents: verification and review

2026-10-27. Native implementation with one independent read-only reviewer.
Changes remain uncommitted on `feat/required-syllabus-contents`.

## Verified locally

- 20 Node tests pass: corpus, evidence, applicability, endpoint compatibility,
  empty/missing pages, rubric references, full statement and processing budget.
- All 9 Playwright browser tests pass: 5 existing upload/report tests and 4
  required-contents tests, including retry, saved reports, partial assessment,
  keyboard expansion, print evidence, and ordinary comparison availability.
- TypeScript, changed-file ESLint, production build (Playwright's production
  server build), and whitespace/diff checks pass.
- Both requirement source snapshots appear in the production route file trace.
- Full-repository lint has 7 existing errors and 2 warnings in unchanged files:
  opportunities/page.tsx, Nav.tsx, audit.spec.ts, meta.ts, opps/discover.ts.
- No live model calls, model credits, migrations, commits or pushes used.
  Playwright Chromium and its test runtime dependencies were downloaded into
  the user's Playwright browser cache; package manifests were unchanged.

## Independent review and fix pass

No critical findings. Five important findings were reproduced with failing
regressions, fixed in one pass, and followed by the full green test suite:

1. Contents-only results now carry an independent ordinary-comparison status;
   they do not disable the five-topic run/retry button.
2. Full-statement matching cannot bridge missing or unreadable pages.
3. Empty extracted pages mark coverage partial and name the unassessed pages.
4. External rubric pointers, including URL-only and Canvas references, need
   review. An incidental URL does not invalidate independently stated criteria.
5. A shared request deadline stops additional batches while retaining partial
   results and page locators. Per-call reserve supports Meta's 55-second and
   configured Baseten's 110-second timeouts. Timing tests use an injected clock.

## Deferred minor findings

- `saveAudit` is invoked in the new functional React state updater. React can
  replay an updater, causing an extra idempotent upsert of the same saved audit.
  Move persistence outside the updater in a later lifecycle cleanup.
- The browser test titled "late response does not overwrite a newer ... result"
  tests a pending response during a course switch and then a later request;
  it does not force overlapping responses. Controls disable context edits
  during a check. Rename the test or add an explicit overlap test later.

## Rulings and limits

- Keep the existing checkout and prerequisite corpus changes on a local feature
  branch rather than a separate worktree. This preserves dependencies and edits
  but does not isolate simultaneous filesystem writers.
- Use a PowerShell-native ignored progress ledger because Bash is unavailable.
  Retain it while work is uncommitted; no commit history yet records task states.
- Extract a dependency-injected endpoint handler and add validated contentsOnly
  mode. This permits offline endpoint tests and avoids repeated model work;
  the additional flag must remain validated.
- Use graduate-specific policy passages when graduate context is selected.
  Unknown-level results retain unknown applicability; wrong student context
  can still select an inappropriate reference section.
- Live model extraction quality remains unverified. Deterministic quote gates
  were tested, but correct relevance tagging is not proved by those tests.
- Actual Vercel execution timing remains unverified. Mocked deadline tests and
  local builds cannot establish deployed latency.
- Actual Supabase sign-in/account-switch behavior remains unverified. Existing
  current-session saving and local-to-account migration behavior was not
  redesigned; this feature does not claim account-switch validation.

Later policy topics in handoff item 3 remain open. The gap list stays private;
these required-contents observations never enter it automatically.
