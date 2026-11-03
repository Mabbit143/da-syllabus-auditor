"""Deterministic lexical candidates, never a policy-applicability verdict."""
from collections import Counter
from math import log
import re

STOP = {"about", "after", "before", "their", "there", "these", "those", "which", "would", "should", "could", "university", "oregon", "policy", "students", "student", "shall", "must", "with", "from", "that", "this", "have", "will", "they", "when", "also", "each"}
METHOD = "bm25_documents_v1"
LIMITS = "Lexical candidates only; relevance, policy applicability, dates and exceptions require evidence review. Unselected documents and passages remain unreviewed. Identical content is collapsed for retrieval, not certified as independent origins."


def tokens(text):
    return Counter(word for word in re.findall(r"[a-z]{4,}", text.lower()) if word not in STOP)


def admitted_spans(version):
    spans = version["metadata"].get("admitted_ranges")
    return [(0, len(version["text"]))] if spans is None else [tuple(span) for span in spans]


def visible_text(version):
    return "\n".join(version["text"][a:b] for a, b in admitted_spans(version))


def content_key(version):
    return version["content_hash"], tuple(admitted_spans(version))


class Retrieval:
    def __init__(self, anchor, candidates):
        self.anchor = anchor
        self.candidates = []
        seen = {content_key(anchor)}
        for version in candidates:
            if content_key(version) not in seen:
                self.candidates.append(version)
                seen.add(content_key(version))
        self.collapsed = len(candidates) - len(self.candidates)
        documents = [anchor] + self.candidates
        self.counts = {v["id"]: tokens(visible_text(v)) for v in documents}
        frequency = Counter(word for counts in self.counts.values() for word in counts)
        self.idf = {word: log(1 + (len(documents) - count + .5) / (count + .5)) for word, count in frequency.items()}
        self.average_length = max(1, sum(sum(c.values()) for c in self.counts.values()) / len(documents))
        title = tokens(anchor["metadata"].get("title") or "")
        weights = {word: (1 + log(count)) * self.idf[word] * (3 if word in title else 1)
                   for word, count in self.counts[anchor["id"]].items()}
        self.query = dict(sorted(weights.items(), key=lambda item: (-item[1], item[0]))[:64])

    def score(self, counts, average=None):
        length = sum(counts.values())
        norm = .25 + .75 * length / (average or self.average_length)
        return sum(weight * self.idf[word] * counts[word] * 2.2 / (counts[word] + 1.2 * norm)
                   for word, weight in self.query.items() if counts[word])

    def select(self):
        ranked = [(self.score(self.counts[v["id"]]), v) for v in self.candidates
                  if len(self.counts[v["id"]].keys() & self.query.keys()) >= 2]
        ranked.sort(key=lambda item: (-item[0], item[1]["id"]))
        selected = [self.anchor] + [version for score, version in ranked[:5] if score > 0]
        return selected, {"method": METHOD, "candidate_documents": len(self.candidates),
                          "identical_content_collapsed": self.collapsed,
                          "matching_related_documents": len(ranked),
                          "omitted_related_documents": max(0, len(ranked) - 5),
                          "query_terms": list(self.query), "limits": LIMITS}

    def passages(self, version, limit):
        spans = [(start, min(start + 5000, end)) for begin, end in admitted_spans(version)
                 for start in range(begin, end, 5000)]
        # A fixed passage length prevents a large document from inflating its
        # passage scores through a document-specific normalization denominator.
        spans.sort(key=lambda span: (-self.score(tokens(version["text"][span[0]:span[1]]), 700), span[0]))
        return spans[:limit]
