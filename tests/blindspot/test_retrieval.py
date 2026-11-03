import tempfile
import unittest
from pathlib import Path

from blindspot.analyze import _context
from blindspot.store import Store


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "research.sqlite")

    def tearDown(self):
        self.temp.cleanup()

    def save(self, name, text, **metadata):
        return self.store.snapshot("https://uoregon.edu/" + name, text, metadata, 10)

    def test_short_topical_policy_survives_long_generic_shared_vocabulary(self):
        general = "campus community teaching research programs faculty academic office support "
        anchor = self.save("report", "Budget retrenchment requires consultation. " + general,
                           title="Budget retrenchment consultation")
        policy = self.save("retrenchment", "Budget retrenchment requires faculty consultation before reductions.",
                           title="Retrenchment consultation", category="policy")
        for index in range(8):
            self.save(f"generic-{index}", (general + "campus budget update ") * 600 + str(index),
                      title="Campus community highlights")
        versions, _, _ = _context(self.store, anchor)
        self.assertEqual(versions[1]["id"], policy)

    def test_identical_copies_do_not_consume_related_document_slots(self):
        anchor = self.save("report", "Budget retrenchment requires faculty consultation.", title="Budget retrenchment")
        for index in range(7):
            self.save(f"copy-{index}", "Budget retrenchment requires consultation with faculty committees.")
        distinct = self.save("distinct", "Budget retrenchment proposals require consultation and a recorded vote.")
        versions, _, _ = _context(self.store, anchor)
        self.assertIn(distinct, [v["id"] for v in versions])
        self.assertEqual(len({v["content_hash"] for v in versions}), len(versions))

    def test_reviewed_scan_ranges_control_retrieval_as_well_as_citations(self):
        anchor = self.save("report", "Budget retrenchment requires faculty consultation.", title="Budget retrenchment")
        admitted = "The parking office opens Monday."
        hidden = " Budget retrenchment requires faculty consultation."
        scan = self.save("scan", admitted + hidden, admitted_ranges=[[0, len(admitted)]])
        versions, _, _ = _context(self.store, anchor)
        self.assertNotIn(scan, [v["id"] for v in versions])

    def test_selection_exposes_method_and_omissions_without_claiming_applicability(self):
        anchor = self.save("report", "Budget retrenchment requires consultation.")
        for index in range(8):
            self.save(f"policy-{index}", f"Budget retrenchment consultation procedure number {index}.")
        versions, context, coverage = _context(self.store, anchor)
        self.assertEqual(len(versions), 6)
        self.assertEqual(context["retrieval"]["method"], "bm25_documents_v1")
        self.assertEqual(context["retrieval"]["omitted_related_documents"], 3)
        self.assertIn("applicability", context["retrieval"]["limits"])
        for version, record in zip(versions, coverage):
            for start, end in record["ranges"]:
                self.assertEqual(version["text"][start:end], next(segment["text"] for document in context["documents"] if document["version_id"] == version["id"] for segment in document["segments"] if segment["start"] == start))

    def test_same_bytes_with_different_reviewed_passages_are_not_collapsed(self):
        anchor = self.save("report", "Budget retrenchment requires consultation.")
        first = "Parking permits are renewed Monday. "
        second = "Budget retrenchment consultation requires a recorded vote."
        self.save("scan-a", first + second, admitted_ranges=[[0, len(first)]])
        relevant = self.save("scan-b", first + second, admitted_ranges=[[len(first), len(first + second)]])
        versions, context, _ = _context(self.store, anchor)
        self.assertIn(relevant, [v["id"] for v in versions])
        document = next(d for d in context["documents"] if d["version_id"] == relevant)
        self.assertEqual(document["segments"][0]["start"], len(first))
        self.assertEqual(document["segments"][0]["text"], second)

    def test_late_relevant_passage_retains_original_offsets(self):
        anchor = self.save("report", "Budget retrenchment requires faculty consultation.", title="Budget retrenchment")
        prefix = "Parking permits and campus events. " * 350
        passage = "Budget retrenchment requires faculty consultation and permits appeals."
        policy = self.save("long-policy", prefix + passage)
        versions, context, _ = _context(self.store, anchor)
        self.assertIn(policy, [v["id"] for v in versions])
        document = next(d for d in context["documents"] if d["version_id"] == policy)
        segment = document["segments"][0]
        self.assertIn(passage, segment["text"])
        self.assertEqual(segment["text"], (prefix + passage)[segment["start"]:segment["end"]])
