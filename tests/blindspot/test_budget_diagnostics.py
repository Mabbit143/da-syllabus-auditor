import json
from pathlib import Path
import tempfile
import unittest

from blindspot.budget import CachedBudgetModel
from blindspot.store import Store


class BudgetDiagnosticTests(unittest.TestCase):
    def test_invalid_json_logs_shape_without_source_content(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory) / "state.sqlite")
            model = CachedBudgetModel(store, lambda *_: '```json\nPRIVATE SOURCE CONTENT\n```', clock=lambda: 100)
            with self.assertLogs("blindspot", level="ERROR") as logs:
                with self.assertRaises(json.JSONDecodeError):
                    model("PATTERN_INVESTIGATOR", "PRIVATE REQUEST")
            diagnostic = " ".join(logs.output)
            self.assertIn("step=incidents", diagnostic)
            self.assertIn("shape=fenced", diagnostic)
            self.assertNotIn("PRIVATE", diagnostic)
            self.assertNotIn("SOURCE", diagnostic)
            with store._db() as db:
                self.assertEqual(db.execute("SELECT count(*) FROM model_cache").fetchone()[0], 0)
                self.assertEqual(db.execute("SELECT calls FROM model_budget").fetchone()[0], 1)

    def test_truncated_json_is_not_repaired_or_cached(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory) / "state.sqlite")
            model = CachedBudgetModel(store, lambda *_: '{"reviews":[', clock=lambda: 100)
            with self.assertLogs("blindspot", level="ERROR") as logs:
                with self.assertRaises(json.JSONDecodeError):
                    model("PATTERN_SKEPTIC", "context")
            diagnostic = " ".join(logs.output)
            self.assertIn("shape=object", diagnostic)
            self.assertIn("column=", diagnostic)
            with store._db() as db:
                self.assertEqual(db.execute("SELECT count(*) FROM model_cache").fetchone()[0], 0)
