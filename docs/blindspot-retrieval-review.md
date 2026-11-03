# Retrieval review — 2026-11-03

The current source-analysis context ranks latest related snapshots by the number
of distinct shared words after a small stop list. It uses the anchor's entire
text, then selects up to five documents and bounded passages. Exact evidence
checking still applies to every proposed citation; retrieval itself proves
neither relevance nor policy applicability.

A read-only check against the actual local corpus reproduced this weakness:

| Anchor | Five related selections, in order |
| --- | --- |
| Senate Budget Committee (version 7) | September 2026 trustees packet (440); Non-Tenure Track Faculty policy (352); Academic Modification Advisory Committee (444); Study Abroad Programs Committee (445); Faculty Personnel Committee (447) |
| November 2 budget-cut reporting (version 459) | September 2026 trustees packet (440); 150 Years of Unstoppable Ducks (410); Non-Tenure Track Faculty policy (352); Syllabus Essentials (16); Syllabus Language Database (126) |

The anniversary and syllabus pages demonstrate that shared vocabulary can
consume the small context budget without establishing a useful policy/action
comparison. These selections were inspected without calling a model. No existing
finding was rewritten or invalidated by this diagnostic alone.

The next retrieval revision should rank passages with corpus frequency and
length normalization, retain exact offsets and admitted scan ranges, expose the
retrieval method and omissions, and test topical policies against long generic
pages and copied boilerplate. Policy selection must remain candidate retrieval:
effective dates, affected populations, exceptions and supersession still require
evidence and Skeptic review. Do not claim an applicable policy merely because a
document ranks highly. Existing historical report inputs must remain immutable.

## Implemented correction

`blindspot/retrieval.py` now uses BM25 document scoring with corpus-frequency
weights, length normalization and a maximum of 64 anchor terms. Anchor title
words receive extra weight only when they also occur in admitted source text.
Identical content with identical admitted ranges is collapsed before computing
corpus statistics and selecting up to five related documents. Different reviewed
passages from the same bytes remain eligible. Neither duplicate collapse nor a
high score establishes independent originating evidence or policy applicability.

Passages use the same weighted query, retaining original character offsets and
the existing 10,000-character anchor / 5,000-character related-source bounds.
Only admitted scan ranges contribute text or ranking terms. Institution-scope
passages and physical/native locators remain subject to existing exact checks.
Reports record the method, candidate/match/omission counts and query terms; the
owner coverage disclosure shows selection limits. Old reports remain unchanged.

A read-only repeat for budget article 459 selected trustees packet 440, donation
reporting 461, Provost entry page 457, budget workbook 438 and President page 8.
The prior anniversary and syllabus selections disappeared. Context preparation
took about three seconds on this computer at this corpus size. This is one
observed relevance improvement, not a comprehensive relevance benchmark: broad
entry pages can still rank, policies using different vocabulary can be missed,
and effective-date/applicability review remains necessary. No live model pass
was run for the changed context because the approved daily allowance was spent.
