import tempfile
import unittest
from pathlib import Path

from blindspot.monitor import cycle, watch
from blindspot.budget import CachedBudgetModel, ModelBudgetExhausted
from blindspot.store import Store


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "state.sqlite"
        self.store = Store(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_overlapping_cycles_and_due_time_are_persisted(self):
        active = self.store.begin_run(10, 60, "verification")
        self.assertIsNone(Store(self.path).begin_run(11, 60, "verification"))
        self.store.end_run(active["id"], active["token"], 12, {"collected": 1}, {"completed": 0})
        self.assertIsNone(self.store.begin_run(71, 60, "verification"))
        self.assertIsNotNone(self.store.begin_run(72, 60, "verification"))

    def test_stale_run_cannot_finish_after_recovery(self):
        old = self.store.begin_run(10, 60, "verification", lease_seconds=60)
        recovered = self.store.begin_run(70, 60, "verification", lease_seconds=60)
        self.assertIsNotNone(recovered)
        with self.assertRaises(ValueError):
            self.store.end_run(old["id"], old["token"], 71, {}, {})
        self.assertEqual(self.store.run_history()[1]["state"], "interrupted")

    def test_timer_cycles_preserve_changes_and_skip_unchanged_versions(self):
        clock = [10]
        text = ["First published administrative requirement."]
        def collect(store, maximum, **kwargs):
            version = store.snapshot("https://uoregon.edu/a", text[0], {}, clock[0])
            store.enqueue("analyze", str(version), {"version_id": version}, clock[0])
            return {"collected": 1, "failed": 0}
        def wait(seconds):
            clock[0] += seconds
            text[0] = "Changed published administrative requirement."
        def analyze(store, ask, **kwargs):
            return {"completed": 0, "failed": 0}
        watch(self.store, [], interval=10, max_cycles=3, clock=lambda: clock[0], wait=wait, collect_pass=collect, analyze_pass=analyze)
        self.assertEqual(len(self.store.run_history()), 3)
        self.assertEqual(len(self.store.history("https://uoregon.edu/a")), 2)
        self.assertTrue(all(run["state"] == "completed" for run in self.store.run_history()))

    def test_failed_cycle_is_recorded_and_next_cycle_remains_due(self):
        def fail(*args, **kwargs):
            raise OSError("network down")
        with self.assertLogs("blindspot", level="ERROR"):
            result = cycle(self.store, [], interval=10, clock=lambda: 10, collect_pass=fail)
        self.assertEqual(result["state"], "failed")
        self.assertEqual(self.store.run_history()[0]["state"], "failed")
        self.assertEqual(self.store.run_history()[0]["error"], "Collection or analysis pass failed; inspect worker logs and queued jobs")


class BudgetTests(unittest.TestCase):
    def test_earlier_recorded_live_calls_are_counted_once_when_budget_is_upgraded(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "state.sqlite"
            store = Store(path)
            store.enqueue("analyze", "legacy", {}, 10)
            job = store.claim(10, 20, kind="analyze")
            store.complete_analysis(job["id"], job["token"], 11, {"findings": [], "model_calls": [{"provider": "baseten", "fallback": False}, {"provider": "baseten", "fallback": False}]})
            with store._db() as db:
                db.execute("DELETE FROM budget_migrations")
                db.execute("INSERT INTO model_budget(day,calls) VALUES ('1970-01-01',1)")
            reopened = Store(path)
            self.assertEqual(reopened.monitor_status()["model_usage"][0]["calls"], 3)
            self.assertEqual(Store(path).monitor_status()["model_usage"][0]["calls"], 3)

    def test_cache_reuses_results_and_daily_budget_survives_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "state.sqlite"
            used = []
            def ask(instructions, context):
                used.append((instructions, context))
                return {"findings": []}
            one = CachedBudgetModel(Store(path), ask, daily_limit=1, clock=lambda: 10)
            self.assertEqual(one("INVESTIGATOR", "document"), {"findings": []})
            two = CachedBudgetModel(Store(path), ask, daily_limit=1, clock=lambda: 11)
            self.assertEqual(two("INVESTIGATOR", "document"), {"findings": []})
            self.assertEqual(len(used), 1)
            self.assertTrue(two.calls[0]["cached"])
            with self.assertRaises(ModelBudgetExhausted):
                two("INVESTIGATOR", "changed document")
            three = CachedBudgetModel(Store(path), ask, daily_limit=1, clock=lambda: 86410)
            three("INVESTIGATOR", "changed document")
            self.assertEqual(len(used), 2)

    def test_malformed_responses_are_not_cached_and_failures_consume_budget(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            model = CachedBudgetModel(store, lambda *args: "not JSON", daily_limit=1, clock=lambda: 10)
            with self.assertRaises(ValueError):
                model("INVESTIGATOR", "document")
            with self.assertRaises(ModelBudgetExhausted):
                model("INVESTIGATOR", "document")


if __name__ == "__main__":
    unittest.main()
