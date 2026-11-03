import tempfile
import unittest
from pathlib import Path

from blindspot.app import query
from blindspot.store import Store


class AppTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "state.sqlite")
        self.version = self.store.snapshot("https://policies.uoregon.edu/a", "Saved public policy text.", {"title": "Example policy", "category": "policy"}, 10)
        self.store.enqueue("analyze", "one", {"version_id": self.version}, 10)
        job = self.store.claim(10, 20, kind="analyze")
        self.store.complete_analysis(job["id"], job["token"], 11, {"schema_version": 2, "findings": [], "observations": [{"id": "f1", "claim": "Policy observation", "evidence": []}]})
        self.report_id = self.store.analyses()[0]["id"]

    def tearDown(self):
        self.temp.cleanup()

    def test_overview_lists_documents_reports_and_authoritative_status(self):
        result = query(self.store, {"action": "overview", "page": 1, "search": "Example"})
        self.assertEqual(result["status"]["documents"], 1)
        self.assertEqual(result["documents"][0]["title"], "Example policy")
        self.assertNotIn("text", result["documents"][0])
        self.assertEqual(result["reports"][0]["id"], self.report_id)

    def test_document_browser_preserves_version_and_text_offsets(self):
        self.store.snapshot("https://policies.uoregon.edu/a", "Changed public policy.", {}, 12)
        result = query(self.store, {"action": "document", "version_id": self.version, "start": 6})
        self.assertEqual(result["text"], "public policy text.")
        self.assertEqual(result["start"], 6)
        self.assertEqual(len(result["history"]), 2)

    def test_reviews_are_append_only_and_survive_restart(self):
        request = {"action": "review", "report_id": self.report_id, "finding_id": "f1", "status": "follow_up", "note": "Check the effective date.", "actor": "verified-owner"}
        query(self.store, request, now=12)
        query(self.store, dict(request, status="reviewed", note="Reviewed the original document."), now=13)
        result = query(Store(self.store.path), {"action": "overview", "page": 1, "search": ""})
        self.assertEqual([r["status"] for r in result["reviews"]], ["reviewed", "follow_up"])
        self.assertEqual(result["reviews"][0]["actor"], "verified-owner")

    def test_unknown_findings_and_invalid_notes_cannot_create_reviews(self):
        for finding, note in [("missing", "Valid note"), ("f1", "")]:
            with self.assertRaises(ValueError):
                query(self.store, {"action": "review", "report_id": self.report_id, "finding_id": finding, "status": "reviewed", "note": note, "actor": "owner"}, now=12)


if __name__ == "__main__":
    unittest.main()
