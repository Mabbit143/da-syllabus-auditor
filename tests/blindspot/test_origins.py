import json
import tempfile
import unittest
from pathlib import Path

from blindspot.store import Store
from blindspot.synthesis import enqueue_synthesis
from blindspot.synthesis_input import build_input, digest
from blindspot.synthesis_state import complete, latest_synthesis


class OriginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "research.sqlite")
        for index, quote in enumerate(["Applications received after Friday were rejected.",
                                       "Applicants without a paid deposit could not enroll.",
                                       "Applicants must attend an orientation before enrollment."]):
            url = f"https://uoregon.edu/source-{index}"
            version = self.store.snapshot(url, quote, {}, 10 + index)
            evidence = {"version_id": version, "url": url, "quote": quote, "content_hash": self.store.get_version(version)["content_hash"],
                        "start": 0, "end": len(quote), "page": None, "role": "action"}
            self.store.enqueue("analyze", str(version), {"version_id": version}, 20 + index)
            job = self.store.claim(20 + index, 60, kind="analyze")
            self.store.complete_analysis(job["id"], job["token"], 21 + index, {"schema_version": 3,
                "findings": [{"id": "f1", "claim": quote, "status": "review_lead", "evidence": [evidence]}]})
        self.context = build_input(self.store)
        enqueue_synthesis(self.store, 100)
        job = self.store.claim(100, 60, kind="synthesize")
        complete(self.store, job, 101, {"evidence": self.context["evidence"], "incidents": [], "patterns": []})
        self.synthesis = latest_synthesis(self.store)
        self.ids = [e["id"] for e in self.context["evidence"]]

    def tearDown(self):
        self.temp.cleanup()

    def save(self, left=0, right=1, relation="same_origin", note="Both passages require originating-record review."):
        from blindspot.origins import save_origin_review
        return save_origin_review(self.store, {"synthesis_id": self.synthesis["id"], "left_id": self.ids[left],
            "right_id": self.ids[right], "relation": relation, "note": note, "actor": "verified-owner"}, now=110)

    def summary(self):
        from blindspot.origins import origin_summary
        return origin_summary(self.store, self.synthesis)

    def test_append_only_owner_assessments_invalidate_input_without_certifying_independence(self):
        self.save()
        self.save(1, 0, "unresolved", "The originating record is not established.")
        summary = self.summary()
        self.assertEqual(len(summary["history"]), 2)
        self.assertEqual(len(summary["latest"]), 1)
        self.assertEqual(summary["latest"][0]["relation"], "unresolved")
        self.assertIsNone(summary["independent_origin_count"])
        self.assertFalse(summary["publication_eligible"])
        self.assertFalse(latest_synthesis(self.store)["input_current"])
        context = build_input(self.store)
        self.assertNotEqual(digest(context), digest(self.context))
        self.assertEqual(context["origin_reviews"][0]["relation"], "unresolved")
        self.assertTrue(enqueue_synthesis(self.store, 120))

    def test_transitive_shared_origin_conflicts_remain_explicit(self):
        self.save(0, 1)
        self.save(1, 2)
        self.save(0, 2, "different_origin", "Different records asserted; resolve the shared-origin chain.")
        summary = self.summary()
        self.assertEqual(len(summary["conflicts"]), 1)
        self.assertEqual(len(summary["same_origin_groups"][0]), 3)
        self.assertIsNone(summary["independent_origin_count"])

    def test_unknown_passages_and_changed_source_fail_without_recording_review(self):
        from blindspot.origins import save_origin_review
        with self.assertRaises(ValueError):
            save_origin_review(self.store, {"synthesis_id": self.synthesis["id"], "left_id": "invented", "right_id": self.ids[1],
                "relation": "same_origin", "note": "No such source passage.", "actor": "verified-owner"}, now=110)
        with self.store._db() as db:
            db.execute("UPDATE content SET text='Changed source text' WHERE hash=?", (self.context["evidence"][0]["content_hash"],))
        with self.assertRaises(ValueError):
            self.save()
        self.assertEqual(self.summary()["history"], [])

    def test_origin_context_respects_existing_character_limit_and_reports_omissions(self):
        from blindspot.origins import attach_origin_context
        self.save(note="Review context. " * 60)
        context = {"evidence": self.context["evidence"], "coverage": {}, "padding": "x" * 58000}
        result = attach_origin_context(self.store, context)
        self.assertLessEqual(len(json.dumps(result)), 60000)
        self.assertEqual(result["coverage"]["omitted_origin_reviews"], 1)

    def test_no_origin_reviews_leave_existing_context_hash_unchanged(self):
        self.assertEqual(build_input(self.store), self.context)

    def test_exact_copied_passage_cannot_be_labeled_different_origin(self):
        first = self.context["evidence"][0]
        url = "https://uoregon.edu/copied-report"
        version = self.store.snapshot(url, first["quote"], {}, 50)
        copy = dict(first, version_id=version, url=url)
        copy["id"] = "e" + digest([version, copy["content_hash"], copy["start"], copy["end"], copy["role"]])[:20]
        report = dict(self.synthesis["report"], evidence=[first, copy])
        with self.store._db() as db:
            db.execute("UPDATE syntheses SET report=? WHERE id=?", (json.dumps(report), self.synthesis["id"]))
        self.ids[1] = copy["id"]
        with self.assertRaisesRegex(ValueError, "Identical"):
            self.save(relation="different_origin")
