# Local Python document-pipeline tests

Run from the Git root (`da-syllabus-auditor/da-syllabus-auditor`). These are
local tests: they do not submit Modal jobs, call an analysis provider, or fetch
public documents. Do not run the deployment/submit commands in the provider
setup guide as part of this test suite.

## Use the isolated interpreter

The existing, Git-ignored environment is `.document-venv/`. On the verified
Windows checkout its interpreter is:

```text
C:\Users\mabbi\dev\da-syllabus-auditor\da-syllabus-auditor\.document-venv\Scripts\python.exe
```

Do not install packages into Hermes's interpreter, the global Python install,
or another project's environment. Invoking plain `python` is not sufficient:
it can select Hermes's Python rather than this project's environment.

In Bash/Git Bash (including Hermes's terminal tool), use:

```bash
env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m pip check
env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m unittest discover -s tests/documents -v
```

In an owner PowerShell session, clear the two overrides in that session before
running the isolated interpreter:

```powershell
Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
Remove-Item Env:PYTHONHOME -ErrorAction SilentlyContinue
.\.document-venv\Scripts\python.exe -m pip check
.\.document-venv\Scripts\python.exe -m unittest discover -s tests/documents -v
```

Clearing these overrides matters even with an explicit interpreter path.
`PYTHONPATH` can prepend a different environment's site-packages, causing a
native package such as Pillow to load the wrong Python-version binary. Clear
it for the process, not just the top-level import: native PDF inspection and
page rendering launch child Python processes using `sys.executable`, and those
children inherit the environment. A top-level `-E` flag alone is not a complete
substitute because that flag is not forwarded to those children.

## Dependencies and rebuilding when necessary

`document_jobs/requirements.txt` is authoritative for the existing pins:

- `modal==1.6.2`
- `pypdfium2==5.14.0`
- `Pillow==13.0.0`

The Modal worker image uses Python 3.12 (see `document_jobs/DEPENDENCIES.md`).
The existing local environment was verified with CPython 3.15.1 on Windows;
this is not a claim that the worker image was re-tested.

Only if the local environment is absent, create it with a deliberately selected
installed Python interpreter, for example Python 3.12 when available:

```bash
env -u PYTHONPATH -u PYTHONHOME py -3.12 -m venv .document-venv
```

Do not replace a working environment just to change its Python version. After
creating an environment, or if its packages are genuinely missing, install
only inside it:

```bash
env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m pip install -r document_jobs/requirements.txt
env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m pip check
```

Dependency installation needs package-index access; running the installed test
suite does not. The offline tests do not need Modal authentication. No package
installation or requirements changes were needed in the verification below.

## Verified scope and troubleshooting

Verified October 31, 2026:

- All **20 tests** in five modules pass, with no skipped tests: CLI/bundles (3),
  download guards (6), extraction limits/provenance (4), native parsing (3),
  and review/admission integrity (4).
- PDFium genuinely parses and renders the committed synthetic
  `e2e/fixtures/syllabus.pdf`, including its child-process extraction path.
- The scanned-PDF test uses a real Pillow-generated PDF and PDFium rendering,
  but mocks Tesseract's subprocess output. Tesseract is not on the verified
  local PATH; this does not prove local engine OCR or hosted OCR works.
- Download tests use mocked DNS/transport. Review/admission tests use temporary
  synthetic bundles, not the real corpus admission manifest.
- `pip check` reports `No broken requirements found.` The three pinned package
  versions above are installed in `.document-venv`.
- Two consecutive final suite runs passed 20/20 with zero skips (1.369 s and
  1.191 s). Both CLI help entry points and compilation checks also exited 0:

  ```bash
  env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m document_jobs.cli --help
  env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m document_jobs.review --help
  env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -m compileall -q document_jobs tests/documents
  ```

Local evidence for this verification is retained outside the repository at
`C:/Users/mabbi/AppData/Local/hermes/cache/scratch/auditor-nov2-python/`:
`baseline-tests.log`, `isolated-initial-tests.log`, `clean-before-tests.log`,
`verified-tests-1.log`, `verified-tests-2.log`, `verified-environment.log`,
`verified-pip-check.log`, and machine-readable `verification-summary.json`.
These scratch files are local diagnostics, not a repository test dependency.

Observed failure modes before using the clean invocation:

1. Plain `python -m unittest discover -s tests/documents` selected Hermes's
   CPython 3.14.9 and ran 20 tests with two errors. Native extraction lacked
   `pypdfium2`; the readable-PDF path surfaced a generic corrupt/encrypted error
   because the child import failed, not because the fixture was corrupt.
2. Selecting `.document-venv` without clearing inherited `PYTHONPATH` ran 20
   tests with one failure and six reported errors (including subtest errors).
   Pillow was imported from Hermes's environment instead of the project and
   failed to import `_imaging`. Do not change fixtures or weaken tests to hide
   this environment mismatch.
3. The same local environment with `PYTHONPATH` and `PYTHONHOME` removed passes
   all 20 tests. No production Python source change is necessary.

For diagnostics, inspect the actual paths as well as version metadata:

```bash
env -u PYTHONPATH -u PYTHONHOME ./.document-venv/Scripts/python.exe -c 'import sys, PIL, pypdfium2; print(sys.executable); print(PIL.__file__); print(pypdfium2.__file__)'
```

Both package paths should be under `.document-venv/Lib/site-packages`, not a
Hermes installation or another environment.

This verifies only the Python document-pipeline suite. Node unit tests,
TypeScript, lint, production build, browser E2E, deployment, live OCR, and
provider credentials/billing require their separate checks.
