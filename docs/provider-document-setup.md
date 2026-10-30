# Provider and public-document setup

2026-10-27: offline integration implemented. 2026-10-29: owner confirmed the
Modal grant/spend-limit checks below; both Modal apps are now deployed and
have each completed a real job.

| Check | Current evidence |
| --- | --- |
| Meta and Baseten keys | Present locally; values never displayed |
| Analysis setting | Meta remains the current default |
| Baseten inference | Mocked routing tested; new live smoke not run |
| Modal SDK | 1.6.2 installed in `.document-venv` |
| Modal login | Authenticated profile present (`mabbit143`) |
| Credit balances and no-charge controls | Owner-confirmed 2026-10-29 |
| Modal deployment/actual OCR | `da-syllabus-ocr` deployed and invoked live through `/api/ocr`: HTTP 200, correct text returned. `da-public-policy-documents` deployed; one real job against a live `provost.uoregon.edu` PDF completed (download, extract, page render) and sits in `.document-review/` awaiting owner quote review/approve/import — that step still requires manual source-image attestation and was not done automatically. |
| Baseten published terms | Model APIs zero retention and no training stated in published Security Practices; account-specific overrides not inspected |
| Native document processing | Real PDFium extraction/rendering tested locally; Tesseract engine is not on local PATH; OCR parsing tested with mocked engine output |

Architecture: Baseten analysis (`meta-models/muse-spark-open-1026`), Meta web
research, Modal public-policy document jobs. Default stays Meta until activation.
No automatic provider fallback or duplicate inference calls. Modal never receives
student PDFs. The upload disclosure derives from the server's provider setting.

## Read-only preflight

Run from the repository root:

```powershell
node scripts/provider-status.mjs
.\.document-venv\Scripts\python.exe -m document_jobs.cli status
```

These commands report presence and unverified states, not balances or proof of
working credentials. They do not call models or create compute jobs.

## Owner account setup before live use

1. Check Baseten's dashboard for the actual remaining hackathon grant and
   applicable no-charge controls. Check the account has no retention/logging
   overrides incompatible with private syllabi. The published terms say inputs
   are not used for training and Model APIs have zero retention, subject to
   customer-controlled configurations: https://www.baseten.co/security-practices/.
2. Log in to Modal from your own terminal:

   ```powershell
   .\.document-venv\Scripts\python.exe -m modal setup
   ```

   Enter credentials only through Modal's login flow. Do not paste tokens into
   chat, the repository, or a browser-visible environment variable.
3. Verify the $100 Modal grant is actually applied and applicable. Set its net
   spend limit to $0 in Usage & Billing, and a gross usage budget within available
   credits. Gross workspace usage and net spend are distinct; defaults can allow
   out-of-pocket charges. Documentation: https://modal.com/docs/guide/budgets.

Only after those checks, use the following one-call/one-page smoke workflow.
Flags attest that the owner checked the account; software cannot infer the
balance from the grant email. Do not enable a paid plan or purchase more credits.

## Baseten activation

```powershell
node scripts/baseten-smoke.mjs --credits-verified
```

This sends one fixed synthetic prompt, uses a 512-token ceiling, never sends a
syllabus, and never retries/falls back. Empty text is reported as failure, not
success; reasoning is never logged. Then explicitly set `MODEL_PROVIDER=baseten`
in `.env.local` and the deployment environment when ready. Restart/rebuild for
the disclosure to reflect the new setting. Keep `MODEL_API_KEY` for research.
Do not push/deploy Vercel changes without the required owner approval.

Rollback: set `MODEL_PROVIDER=meta`, restart/rebuild, preserve both keys privately.

## Modal deployment and a public one-page smoke

```powershell
.\.document-venv\Scripts\python.exe -m modal deploy document_jobs/modal_app.py
.\.document-venv\Scripts\python.exe -m document_jobs.cli preview --source https://provost.uoregon.edu/sites/default/files/2021-10/211004.ada_.pg_.accessibility_0.pdf --pages 1
.\.document-venv\Scripts\python.exe -m document_jobs.cli submit --source https://provost.uoregon.edu/sites/default/files/2021-10/211004.ada_.pg_.accessibility_0.pdf --pages 1 --credits-verified
```

Only explicitly listed corpus URLs are accepted. The worker has one CPU container,
one input at a time, zero retries, a 300-second deadline and 1 GiB memory. It
processes one PDF with at most 20 selected pages, 20 MB download, 200 DPI,
16 million pixels/page, 2 MB evidence PNG/page and 16 MB result bundle. These
limits bound work, not dollars. Authentication is the owner's Modal profile;
there is no public HTTP endpoint or student submission route.

The CLI prints a stable 24-character job ID. Use it to poll:

```powershell
.\.document-venv\Scripts\python.exe -m document_jobs.cli collect --job <job-id>
```

`<job-id>` is a value printed by submit, not literal command text. Pending jobs
remain pending. Output is saved under `.document-review/<job-id>/`. Existing
bundles and submission reservations are not overwritten. A failed reservation
must be inspected before a deliberate retry; do not submit multiple jobs blindly.
Modal completed-call results expire; collect promptly. Preview/collect alone do
not admit evidence or alter the policy corpus.

## Review and admission

1. Open the local bundle's preview and page PNG. Check the intended exact
   passage against the source pixels. OCR confidence is insufficient approval.
2. Put the approved exact passage in `quote.txt` inside that bundle. Identify
   the rendered-image region as x,y,width,height. If OCR needs correction,
   re-create and re-review the artifact; a receipt never bypasses exact matching.
3. Run `python -m document_jobs.review --help` using the isolated interpreter.
   `approve` requires the job ID, a supported topic, PDF page, region and
   `--confirm-reviewed`. That flag is the owner's source-image review attestation;
   the worker cannot approve its own output. The command prints a receipt ID.
4. Run `import` with the bundle and receipt IDs. Without `--apply` it only
   previews. Add `--select` to explicitly replace the topic's current selection;
   add `--apply` only after inspecting the preview to write the admission.

Both quote and image hashes are checked again before import and on application
lookup. Committed admissions include artifacts and optional PDF provenance;
unreviewed bundles stay ignored and never enter findings or the gap list.
The initial admission manifest is empty, so existing reference selections remain.
To roll back an admission, deselect/revert its manifest change; keep review files.

## Verification commands

```powershell
node --experimental-strip-types --test lib/providers.test.mts lib/meta.test.mts lib/policy/*.test.mts
.\.document-venv\Scripts\python.exe -m unittest discover -s tests/documents -v
npm.cmd run test:e2e
npx.cmd tsc --noEmit
npm.cmd run build
git diff --check
```

Python image/parser tests use synthetic fixtures. The OCR engine boundary is
mocked locally; an actual Modal OCR smoke remains required. No live API credits
or compute jobs were used during offline verification. The setup command may
write the authenticated Modal profile outside the repo only when the owner runs it.
