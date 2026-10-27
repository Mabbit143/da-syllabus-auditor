# DA Syllabus Auditor

Project started 2026-10-26 for the Meta Global AI Developer Hackathon (submission due Nov 4, 2026, 9 PM ET). The app is built and live on Vercel: https://da-syllabus-auditor-hkrr.vercel.app

A student uploads a syllabus PDF and gets an audit on five dimensions with verbatim, code-verified quotes, risk flags, a fix for each finding, funding search, and a comparison of the syllabus against the school's own written policies. University of Oregon comes first.

Start here:

- `AGENTS.md` — context for coding agents (read first).
- `CLAUDE.md` — longer project notes.
- `docs/handoff-muse-code.md` — current priorities, acceptance criteria and open checks (tick the boxes as you verify them).
- `docs/spec-da-syllabus-auditor-v1.md` — build contract. `docs/prd-da-syllabus-auditor.md` — product.

Run it: `npm install`, then `npm run dev` (port 3000). Typecheck: `npx tsc --noEmit`. E2E: `npm run test:e2e`.
