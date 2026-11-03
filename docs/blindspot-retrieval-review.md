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

This is a verified open quality issue, not a completed retrieval improvement.
