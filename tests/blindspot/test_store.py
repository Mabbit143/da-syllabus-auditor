import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from blindspot.store import Store


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "research.sqlite"
        self.store = Store(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_versions_preserve_changes_and_reversions(self):
        a = self.store.snapshot("https://uoregon.edu/a", "First policy", {"category": "policy"}, 10)
        self.assertEqual(a, self.store.snapshot("https://uoregon.edu/a", "First policy", {}, 11))
        b = self.store.snapshot("https://uoregon.edu/a", "Changed policy", {}, 12)
        c = self.store.snapshot("https://uoregon.edu/a", "First policy", {}, 13)
        self.assertEqual(len({a, b, c}), 3)
        history = Store(self.path).history("https://uoregon.edu/a")
        self.assertEqual([v["text"] for v in history], ["First policy", "Changed policy", "First policy"])
        self.assertEqual(history[0]["last_seen"], 11)
        self.assertIsNone(history[0]["metadata"].get("published_at"))

    def test_identical_content_retains_both_sources(self):
        a = self.store.snapshot("https://uoregon.edu/a", "Shared release", {"origin": "release"}, 10)
        b = self.store.snapshot("https://news.example/a", "Shared release", {"origin": "unknown"}, 11)
        self.assertNotEqual(a, b)
        one = self.store.history("https://uoregon.edu/a")[0]
        two = self.store.history("https://news.example/a")[0]
        self.assertEqual(one["content_hash"], two["content_hash"])
        self.assertNotEqual(one["url"], two["url"])

    def test_repeated_enqueue_does_not_reset_live_job(self):
        job_id = self.store.enqueue("collect", "source", {"url": "a"}, 10)
        job = self.store.claim(10, 20)
        self.assertEqual(job_id, self.store.enqueue("collect", "source", {"url": "b"}, 0))
        self.assertIsNone(self.store.claim(11, 20))
        self.assertEqual(job["payload"], {"url": "a"})

    def test_concurrent_claim_and_stale_completion(self):
        self.store.enqueue("collect", "a", {}, 10)
        with ThreadPoolExecutor(2) as pool:
            claims = list(pool.map(lambda _: Store(self.path).claim(10, 5), range(2)))
        active = [job for job in claims if job]
        self.assertEqual(len(active), 1)
        old = active[0]
        new = self.store.claim(15, 5)
        self.assertIsNotNone(new)
        with self.assertRaises(ValueError):
            self.store.finish(old["id"], old["token"], 16)
        self.store.finish(new["id"], new["token"], 16)
        self.assertIsNone(self.store.claim(100, 5))

    def test_failure_retries_and_survives_restart(self):
        self.store.enqueue("collect", "a", {}, 10)
        job = self.store.claim(10, 10)
        self.store.finish(job["id"], job["token"], 11, error="HTTP 503")
        reopened = Store(self.path)
        self.assertIsNone(reopened.claim(12, 10))
        retry = reopened.claim(1000, 10)
        self.assertEqual(retry["attempts"], 2)
        self.assertEqual(retry["last_error"], "HTTP 503")

    def test_expired_lease_cannot_complete_without_reclaim(self):
        self.store.enqueue("collect", "a", {}, 10)
        job = self.store.claim(10, 5)
        with self.assertRaises(ValueError):
            self.store.finish(job["id"], job["token"], 15)

    def test_invalid_inputs_do_not_create_evidence_or_jobs(self):
        with self.assertRaises(ValueError):
            self.store.snapshot("https://uoregon.edu/a", "   ", {}, 10)
        with self.assertRaises(ValueError):
            self.store.claim(10, 0)

    def test_live_analysis_precedes_archived_backlog(self):
        self.store.enqueue("analyze", "old", {}, 10, priority=0)
        self.store.enqueue("analyze", "live", {}, 11, priority=10)
        self.assertEqual(self.store.claim(12, 10, kind="analyze")["key"], "live")

    def test_old_schema_upgrade_preserves_jobs_and_prioritizes_live_sources(self):
        archive = self.store.snapshot("https://uoregon.edu/archive", "Historical policy text.", {"archived_snapshot": True}, 10)
        live = self.store.snapshot("https://uoregon.edu/live", "Newly collected policy text.", {}, 11)
        self.store.enqueue("analyze", "old", {"version_id": archive}, 10)
        self.store.enqueue("analyze", "live", {"version_id": live}, 11)
        with self.store._db() as db:
            db.execute("ALTER TABLE jobs DROP COLUMN priority")
        reopened = Store(self.path)
        claimed = reopened.claim(12, 10, kind="analyze")
        self.assertEqual(claimed["key"], "live")
        self.assertEqual(claimed["priority"], 10)
        reopened.finish(claimed["id"], claimed["token"], 13)
        self.assertEqual(reopened.claim(14, 10, kind="analyze")["key"], "old")


if __name__ == "__main__":
    unittest.main()
