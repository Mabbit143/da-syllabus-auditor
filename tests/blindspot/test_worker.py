import tempfile
import unittest
from pathlib import Path

from blindspot.store import Store
from blindspot.worker import run_once, seed


class WorkerTests(unittest.TestCase):
    def test_repeated_seeding_is_idempotent_and_next_period_is_new_work(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "s.sqlite")
            sources = [{"url": "https://example.com/a", "category": "policy"}]
            seed(store, sources, 10, interval=60)
            seed(store, sources, 11, interval=60)
            called = []
            result = run_once(store, 5, clock=lambda: 12, collector=lambda *args: called.append(args) or {"version_id": 1, "url": sources[0]["url"], "links": []})
            self.assertEqual(result["collected"], 1)
            self.assertEqual(len(called), 1)
            seed(store, sources, 61, interval=60)
            result = run_once(store, 5, clock=lambda: 62, collector=lambda *args: {"version_id": 1, "url": sources[0]["url"], "links": []})
            self.assertEqual(result["collected"], 1)

    def test_failures_retry_and_limit_preserves_backlog(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "s.sqlite")
            seed(store, [{"url": "https://example.com/a"}, {"url": "https://example.com/b"}], 10)
            def fail(*args):
                raise ValueError("HTTP 503")
            with self.assertLogs("blindspot", level="ERROR") as logs:
                result = run_once(store, 1, clock=lambda: 11, collector=fail)
            self.assertIn("HTTP 503", logs.output[0])
            self.assertEqual(result["failed"], 1)
            self.assertEqual(result["processed"], 1)
            remaining = store.claim(11, 10)
            self.assertIsNotNone(remaining)
            self.assertEqual(remaining["payload"]["url"], "https://example.com/b")

    def test_repeated_versions_do_not_queue_duplicate_analysis(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "s.sqlite")
            source = {"url": "https://example.com/a"}
            seed(store, [source], 10, interval=60)
            collector = lambda *args: {"version_id": 1, "url": source["url"], "links": []}
            run_once(store, 1, clock=lambda: 11, collector=collector)
            analysis = store.claim(12, 10, kind="analyze")
            self.assertIsNotNone(analysis)
            store.finish(analysis["id"], analysis["token"], 13)
            seed(store, [source], 61, interval=60)
            run_once(store, 1, clock=lambda: 62, collector=collector)
            self.assertIsNone(store.claim(63, 10, kind="analyze"))

    def test_unknown_source_categories_do_not_erase_attribution(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "s.sqlite")
            seed(store, [{"url": "https://example.com/a", "category": "news", "discovered_from": "https://example.com/"}], 10)
            job = store.claim(11, 10, kind="collect")
            self.assertEqual(job["payload"]["category"], "news")
            self.assertEqual(job["payload"]["discovered_from"], "https://example.com/")

    def test_explicit_source_priority_orders_new_analysis_without_dropping_backlog(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "s.sqlite")
            store.enqueue("analyze", "generic", {"version_id": 1}, 10, priority=10)
            source = {"url": "https://example.com/report", "analysis_priority": 30}
            seed(store, [source], 10)
            run_once(store, 1, clock=lambda: 11, collector=lambda *args: {"version_id": 2, "url": source["url"], "links": []})
            job = store.claim(12, 10, kind="analyze")
            self.assertEqual(job["payload"]["version_id"], 2)
            self.assertEqual(job["priority"], 30)
            self.assertEqual(store.claim(12, 10, kind="analyze")["key"], "generic")

    def test_priority_reconciliation_preserves_budget_due_time_and_active_claim(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "s.sqlite")
            url = "https://example.com/report"
            old = store.snapshot(url, "An earlier source version.", {}, 10)
            store.enqueue("analyze", str(old), {"version_id": old}, 10, priority=10)
            active = store.claim(11, 100, kind="analyze")
            latest = store.snapshot(url, "A revised source version.", {}, 12)
            pending = store.enqueue("analyze", str(latest), {"version_id": latest}, 1000, priority=10)
            seed(store, [{"url": url, "analysis_priority": 30}], 13)
            with store._db() as db:
                row = db.execute("SELECT * FROM jobs WHERE id=?", (pending,)).fetchone()
                running = db.execute("SELECT * FROM jobs WHERE id=?", (active["id"],)).fetchone()
            self.assertEqual(row["priority"], 30)
            self.assertEqual(row["due"], 1000)
            self.assertEqual(row["attempts"], 0)
            self.assertEqual(running["priority"], 10)
            self.assertEqual(running["token"], active["token"])
            self.assertEqual(running["state"], "running")


if __name__ == "__main__":
    unittest.main()
