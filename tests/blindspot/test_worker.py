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


if __name__ == "__main__":
    unittest.main()
