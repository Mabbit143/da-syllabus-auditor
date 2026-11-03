import tempfile
import unittest
from pathlib import Path

from blindspot.search import discover_web, registered_sources, search_status, replay_discovery
from blindspot.store import Store


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "research.sqlite")

    def tearDown(self):
        self.temp.cleanup()

    def test_confirmed_search_registers_relevant_sources_and_queues_real_fetches(self):
        def ask(instructions, context):
            self.assertIn("DISCOVERY", instructions)
            return {"search_confirmed": True, "results": [
                {"url": "https://news.example/uo-interview", "snippet": "University of Oregon administrators discuss access."},
                {"url": "https://news.example/unrelated", "snippet": "Another institution."},
                {"url": "https://127.0.0.1/internal", "snippet": "University of Oregon"},
                {"url": "https://news.example/uo-interview#section", "snippet": "University of Oregon"},
            ]}
        result = discover_web(self.store, ask, clock=lambda: 10)
        self.assertEqual(result["registered"], 1)
        source = registered_sources(self.store)[0]
        self.assertEqual(source["url"], "https://news.example/uo-interview")
        self.assertIn("web-search:", source["discovered_from"])
        self.assertIsNotNone(self.store.claim(11, 10, kind="collect"))
        self.assertEqual(self.store.status()["documents"], 0)

    def test_unconfirmed_narrative_is_not_source_discovery(self):
        result = discover_web(self.store, lambda *args: {"search_confirmed": False, "results": []}, clock=lambda: 10)
        self.assertEqual(result["state"], "unconfirmed")
        self.assertEqual(registered_sources(self.store), [])
        self.assertEqual(search_status(self.store)["queries"][0]["state"], "unconfirmed")

    def test_empty_tool_snippets_do_not_exclude_independent_reporting(self):
        discover_web(self.store, lambda *args: {"search_confirmed": True, "results": [{"url": "https://dailyemerald.com/administration/budget", "snippet": ""}]}, clock=lambda: 10)
        source = registered_sources(self.store)[0]
        self.assertTrue(source["relevance_unverified"])
        self.assertEqual(source["category"], "news")
        self.assertEqual(self.store.claim(11, 10, kind="collect")["priority"], 5)

    def test_completed_search_results_can_be_replayed_without_model_calls(self):
        discover_web(self.store, lambda *args: {"search_confirmed": True, "results": [{"url": "https://news.example/report", "snippet": "University of Oregon"}]}, clock=lambda: 10)
        with self.store._db() as db:
            db.execute("DELETE FROM discovered_sources")
        self.assertEqual(replay_discovery(self.store, now=11)["registered"], 1)
        self.assertEqual(replay_discovery(self.store, now=12)["registered"], 0)
        self.assertEqual(len(search_status(self.store)["queries"]), 1)

    def test_two_attempt_daily_limit_survives_restart_and_rotates_queries(self):
        queries = []
        def ask(instructions, context):
            queries.append(context)
            return {"search_confirmed": True, "results": []}
        discover_web(self.store, ask, clock=lambda: 10)
        discover_web(Store(self.store.path), ask, clock=lambda: 11)
        result = discover_web(self.store, ask, clock=lambda: 12)
        self.assertEqual(result["state"], "daily_search_limit")
        self.assertEqual(len(queries), 2)
        self.assertNotEqual(queries[0], queries[1])

    def test_failed_search_is_recorded_without_stopping_collection(self):
        def fail(*args):
            raise ValueError("provider unavailable")
        result = discover_web(self.store, fail, clock=lambda: 10)
        self.assertEqual(result["state"], "failed")
        self.assertEqual(search_status(self.store)["queries"][0]["state"], "failed")
        self.assertEqual(registered_sources(self.store), [])


if __name__ == "__main__":
    unittest.main()
