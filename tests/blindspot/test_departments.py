import json
import tempfile
import unittest
from pathlib import Path

from blindspot.analyze import analyze_version
from blindspot.evidence import report_view
from blindspot.store import Store


class DepartmentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "research.sqlite")
        self.quote = "The Department of Classics requires applications by October 1."
        self.version = self.store.snapshot("https://uoregon.edu/procedure", self.quote,
                                           {"title": "Department of Biology procedure"}, 10)

    def tearDown(self):
        self.temp.cleanup()

    def analyze(self, departments):
        captured = []
        def ask(instructions, context):
            if "SKEPTIC" in instructions:
                captured.extend(json.loads(context)["proposals"])
                return {"reviews": [{"id": "f1", "decision": "retain", "reason": "A quoted administrative deadline.",
                    "counterevidence_search": "Supplied text only.", "alternative_explanations": [],
                    "temporal_scope": "Effective year unknown.", "counterevidence": []}]}
            return {"findings": [{"id": "f1", "claim": "The department states an application deadline.",
                "topic": "Applications", "mechanism": "deadline", "temporal_scope": "Effective year unknown.",
                "questions": ["Which year and applicants does this cover?"],
                "evidence": [{"version_id": self.version, "quote": self.quote, "role": "action"}],
                "departments": departments}]}
        return analyze_version(self.store, self.version, ask), captured

    def test_scope_uses_verified_quote_and_reaches_skeptic(self):
        scope = [{"name": "Department of Classics", "evidence_index": 0}]
        report, captured = self.analyze(scope)
        self.assertEqual(report["findings"][0]["departments"], scope)
        self.assertEqual(captured[0]["departments"], scope)

    def test_metadata_guesses_substrings_and_invalid_indexes_are_omitted(self):
        bad = [{"name": "Department of Biology", "evidence_index": 0},
               {"name": "Department of Classic", "evidence_index": 0},
               {"name": "Department of Classics", "evidence_index": 1},
               {"name": "Department of Classics", "evidence_index": False}]
        report, captured = self.analyze(bad)
        self.assertEqual(report["findings"][0]["departments"], [])
        self.assertEqual(captured[0]["departments"], [])
        self.assertEqual(report["department_labels_rejected"], 4)
        self.assertEqual(len(report["findings"]), 1)

    def test_duplicate_and_whitespace_variants_do_not_inflate_scope(self):
        report, _ = self.analyze([{"name": "Department\n of Classics", "evidence_index": 0},
                                  {"name": "Department of Classics", "evidence_index": 0}])
        self.assertEqual(report["findings"][0]["departments"], [{"name": "Department of Classics", "evidence_index": 0}])

    def test_legacy_scope_is_unknown_and_projection_keeps_history_unchanged(self):
        raw = {"schema_version": 2, "findings": [{"id": "old", "evidence": [{"role": "action", "quote": self.quote}],
                "departments": [{"name": "Department of Biology", "evidence_index": 0}]}]}
        before = json.dumps(raw, sort_keys=True)
        projected = report_view(raw)
        self.assertEqual(projected["findings"][0]["departments"], [])
        self.assertEqual(json.dumps(raw, sort_keys=True), before)
