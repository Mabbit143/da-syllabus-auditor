# Evidence-admission runbook

Working procedure for adding more institutional-evidence records to
`data/uo-policies/reviewed-ocr/`, surfaced on the public `/evidence` page.
This is **not scriptable end-to-end** — the human-attestation gate in
`document_jobs/review.py` (`--confirm-reviewed`) exists specifically so no
one, including an agent, can approve its own extraction without a real check
against the source pixels. Follow this procedure; don't shortcut the visual
check.

As of 2026-10-30, 2 of 239 manifest PDFs are processed, both admitted:
`academic_integrity` and `registration_holds`.

## 1. Pick a batch

Source list: `data/uo-policies/pdf/_index.json` (`manifest_urls()` in
`document_jobs/cli.py` reads it). Work in batches of 5–10 URLs.

On a first pass, **skip** filenames containing any of: `PAC Agenda`,
`REPEAL`, `Redline`, `REVISION`, `Proposal`. These are committee-process or
superseded-version documents, not stated rules — low value for an
accountability record and more likely to be drafts.

Prefer filenames suggesting a finalized, substantive policy: `SOP-*`,
`*Policy*` without "Redline"/"DRAFT"/"Proposal" in the name, documents from
`senate.uoregon.edu`, `dos.uoregon.edu`, `provost.uoregon.edu`.

## 2. Run the job

```
.document-venv/Scripts/python.exe -m document_jobs.cli preview --source "<url>" --pages 1-2
.document-venv/Scripts/python.exe -m document_jobs.cli submit --source "<url>" --pages 1-2 --credits-verified
# wait ~15s for the Modal container
.document-venv/Scripts/python.exe -m document_jobs.cli collect --job <job-id>
```

Start with `--pages 1-2`. If the document's substance is further in (common
for long SOPs with a cover page and table of contents — see the pitfall
below), resubmit with a wider range, e.g. `--pages 1-4`. Each `submit` is a
new job id; `collect` writes to `.document-review/<job-id>/`.

## 3. Reject drafts and non-substantive pages

Open `.document-review/<job-id>/preview.md` and read the extracted text
before touching the image. Reject and stop (pick a different URL or page
range) if:

- The page is watermarked or titled "DRAFT", "Proposal", "for discussion",
  or similar — confirmed once already this session on a Senate discussion
  brief; always check, don't trust the filename.
- The page is a title/cover page, table of contents, or author-list page
  with no actual rule stated — confirmed once already this session (a
  "Practitioner Guide" cover page with no policy content at all). If page 1
  is a cover page, try `--pages 2-3` next.

## 4. Decide the topic: existing or new

Check `data/evidence-topics.json`. Does the passage fit one of the existing
12 topics? If yes, use that `id`.

If not, **don't force it** — this is exactly the mistake already corrected
once this session (skipping a document because it didn't fit, instead of
expanding the taxonomy). Add a new entry to `data/evidence-topics.json`:

```json
{ "id": "new_topic_slug", "label": "Human-readable label", "description": "One sentence, plain language.", "syllabusComparable": false }
```

Rules for the new entry:
- `id` is `snake_case`, short, matches what you'll pass to `--topic`.
- `syllabusComparable` is **almost always `false`** for a new topic. Only
  set it `true` if you also intend to add it to `lib/policy/types.ts`'s
  `POLICY_TOPICS` and a `SOURCES` entry in `lib/policy/corpus.ts` — that's a
  separate, deliberate decision with real model-cost implications (see the
  plan at `.hermes/plans/2026-10-30_002511-open-evidence-topic-registry.md`
  for why). Don't do it as a side effect of an evidence admission.
- If genuinely unsure what to name a new topic, propose it to the owner
  before admitting anything under it — the same way `registration_holds`
  was proposed and confirmed before use.

No code changes are needed to use a new topic — `document_jobs/review.py`
reads the registry at import time.

## 5. Pick the quote

Pick one **complete, self-contained** passage, 40–700 characters, that
states an actual rule (not a heading, not a cross-reference, not a table of
contents line). A full numbered item or one full sentence works well — both
admitted records so far used a complete item/sentence, not a partial clause.

## 6. Visually confirm against the page image

Load `.document-review/<job-id>/page-<N>.png` and:
1. Ask whether the page is watermarked DRAFT (confirms step 3 against the
   actual rendering, not just the extracted text).
2. Ask for the bounding box of your chosen quote in original pixel
   coordinates.
3. Re-crop with that box and confirm it shows *only* the intended passage —
   nothing from the item before or after. Adjust and re-crop until clean.
   Both admissions so far needed 2–3 crop iterations to land a tight box.

Pixel coordinates from a vision tool: watch for whether it reports
downscaled-image coordinates (the tool will say so and give you a multiplier
— multiply before using) versus crop-relative coordinates (it will say "add
the offset back" — add the crop's x1,y1 before using).

## 7. Extract the quote byte-exactly — do not hand-type it

PDFium's text extraction uses literal `\r\n` for line wraps. Typing or
copy-pasting the quote risks losing those bytes, which breaks the exact
match `review.py` requires. Always extract programmatically from
`result.json`:

```python
import json
from pathlib import Path

bundle = Path(".document-review/<job-id>")
data = json.loads((bundle / "result.json").read_text(encoding="utf8"))
page = next(p for p in data["pages"] if p["page"] == <N>)
text = page["text"]

start = text.index("<first few words of your quote>")
end = text.index("<last few words of your quote>") + len("<last few words of your quote>")
exact = text[start:end]
(bundle / "quote.txt").write_text(exact, encoding="utf8", newline="")
print(len(exact), repr(exact))
```

Save this as a throwaway script in the scratch directory, run it with
`.document-venv/Scripts/python.exe`, and confirm the printed length is
40–700 and the repr looks right before moving on.

## 8. Approve

```
.document-venv/Scripts/python.exe -m document_jobs.review approve --bundle <job-id> --topic <topic_id> --page <N> --region "x,y,w,h" --confirm-reviewed
```

Prints a receipt JSON with an `id`. Save it.

If this fails with "Topic or exact reviewed quote is invalid": either the
topic isn't in the registry (check step 4), the quote isn't an exact
substring (check step 7 — this is almost always a `\r\n` mismatch), or the
region is outside the page bounds.

## 9. Import — preview first, then apply

```
.document-venv/Scripts/python.exe -m document_jobs.review import --bundle <job-id> --receipt <receipt-id> --select
```

Read the printed preview. Only if it looks right:

```
.document-venv/Scripts/python.exe -m document_jobs.review import --bundle <job-id> --receipt <receipt-id> --select --apply
```

`--select` makes this the active record for its topic. For an
evidence-only topic (`syllabusComparable: false`) `--select` doesn't affect
anything in the live syllabus-audit path — it's harmless to always include
it. **Do not omit `--select` by habit** on a topic that's also a
`PolicyTopic` (one of the 11 syllabus-comparable ones) unless you
specifically intend to change what the live audit shows for that topic —
see the pitfall below.

## 10. Verify

```
npm run dev
curl -s http://127.0.0.1:3000/evidence --max-time 10 | grep -o "<a snippet of your quote>"
```

Confirm the new record renders under the right topic label.

Then re-run the full check:

```
.document-venv/Scripts/python.exe -m unittest discover -s tests/documents -v
node --experimental-strip-types --test lib/policy/*.test.mts
npx tsc --noEmit
```

Commit the two new files under `data/uo-policies/reviewed-ocr/artifacts/`
plus the updated `index.json` (and `data/evidence-topics.json` if you added
a topic) as one `data: admit <topic> evidence record` commit.

## Pitfalls hit so far (read before repeating them)

1. **A quote crossing a PDF line-wrap silently fails approval.**
   `review.py` used to read `quote.txt` with `.read_text()`, which
   does universal-newline translation and collapses the PDF's literal
   `\r\n` to `\n`, breaking the exact-substring check against `page.text`
   for any multi-line quote. Fixed in commit `0fc1a78` (now reads bytes).
   If you ever see this bug again elsewhere, the fix is: read as bytes,
   decode, don't let anything touch it in text mode.

2. **Admitting evidence under a `PolicyTopic` topic changes what every live
   syllabus audit sees for that topic**, because `lib/policy/corpus.ts`'s
   `corpusPolicies()` prefers a `selected: true` reviewed-OCR record over the
   hardcoded markdown-snapshot quote. This broke `lib/policy/corpus.test.mts`
   once already (the `academic_integrity` walkthrough admission overrode the
   curated snapshot quote mid-session). If you're admitting evidence purely
   for the public record and don't intend to change the live audit's source
   for that topic, either: (a) use an evidence-only topic
   (`syllabusComparable: false`) where this doesn't apply, or (b) import
   without `--select`, then if it was previously selected, re-run `import`
   on the *old* receipt without `--select` to flip it back (see
   `lib/policy/evidence.ts`'s doc comment: `approved` gates the public
   evidence page, `selected` only gates the live audit source).

3. **A document's page 1 is sometimes a cover page or table of contents**
   with no actual rule — don't admit a title page as "evidence." If page 1
   has nothing, widen the page range and look further in, don't force a
   quote out of what's there.

4. **Filenames lie about draft status.** Always visually check the rendered
   page for a DRAFT watermark before admitting, regardless of what the
   manifest filename says.

5. **A "Clean Version" or non-draft-looking document can still be
   superseded.** The Student Records Policy PDF (`05.00.04 Student Records
   Policy - PAC.pdf`) had no DRAFT watermark, but page 1 was a Policy
   Concept Form stating "This policy has been replaced by UO Policy
   III.05.03" with "Proposed Action: Repeal." Admitting a repealed policy's
   text as current evidence would misrepresent what's actually in effect.
   Read page 1 for repeal/replacement/superseded language before checking
   anything else — a document can pass the draft check and still not be
   current.

6. **Some manifest URLs fail to download or extract entirely** (confirmed
   with the 2016 Exam Policy Clarification PDF and the 2023 UOPD policy
   manual — both returned `status: "failed"` with no page data). Don't
   retry the same URL blindly; log it as a known-failed source and move on.
   A bundle's `result.json` with `"status": "failed"` and `"pages": []`
   means the Modal worker couldn't process it within its limits (download
   size, page count, or format) — there's nothing to review.
