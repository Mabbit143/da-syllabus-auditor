import tempfile
import unittest
from pathlib import Path

from blindspot.discovery import discover, RobotsRules
from blindspot.fetch import SourceHTTPError
from blindspot.store import Store
from blindspot.worker import run_once, seed


class DiscoveryTests(unittest.TestCase):
    def test_uo_discovery_has_scope_depth_and_count_limits(self):
        source = {"url": "https://trustees.uoregon.edu/meetings", "category": "administration"}
        links = ["https://trustees.uoregon.edu/materials.pdf", "https://policies.uoregon.edu/policy", "https://evil-uoregon.edu/a", "https://uoregon.edu.evil/a", "https://trustees.uoregon.edu/events.ics", "https://trustees.uoregon.edu/login", "https://trustees.uoregon.edu/a?calendar=1"]
        found = discover(source, links, max_links=2)
        self.assertEqual([row["url"] for row in found], links[:2])
        self.assertTrue(all(row["discovered_from"] == source["url"] for row in found))
        self.assertTrue(all(row["depth"] == 1 for row in found))
        self.assertEqual(discover(dict(source, depth=2), links), [])

    def test_news_only_follows_relevant_same_publisher_links(self):
        source = {"url": "https://www.opb.org/article/seed/", "category": "news", "publisher": "OPB", "discovery_terms": ["university-of-oregon", "university-oregon"]}
        links = ["https://www.opb.org/article/university-of-oregon-tuition/", "https://www.opb.org/article/other-news/", "https://other.org/university-of-oregon/", "https://www.opb.org/article/university-of-oregon-tuition/#section"]
        found = discover(source, links)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["publisher"], "OPB")
        self.assertEqual(found[0]["url"], links[0])

    def test_robots_is_cached_and_disallowed_urls_fail(self):
        fetched = []
        def fetch(url, **kwargs):
            fetched.append(url)
            return {"body": b"User-agent: *\nDisallow: /private\nCrawl-delay: 7\n", "url": url, "content_type": "text/plain"}
        rules = RobotsRules(fetch=fetch)
        self.assertEqual(rules.check("https://example.com/public"), 7)
        with self.assertRaisesRegex(ValueError, "robots"):
            rules.check("https://example.com/private/doc")
        self.assertEqual(len(fetched), 1)

    def test_missing_robots_allows_but_access_denial_and_server_errors_do_not(self):
        for code in [404, 403, 503]:
            def fetch(url, **kwargs):
                raise SourceHTTPError(code)
            rules = RobotsRules(fetch=fetch)
            if code == 404:
                self.assertEqual(rules.check("https://example.com/a"), 2)
            else:
                with self.assertRaises(ValueError):
                    rules.check("https://example.com/a")

    def test_worker_persists_discovered_links_and_dedupes_next_run(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            seed(store, [{"url": "https://trustees.uoregon.edu/meetings"}], 10)
            def collector(store, source, now):
                return {"version_id": 1, "url": source["url"], "links": ["https://trustees.uoregon.edu/packet.pdf"]}
            result = run_once(store, 1, clock=lambda: 11, collector=collector)
            self.assertEqual(result["discovered"], 1)
            discovered = store.claim(12, 10, kind="collect")
            self.assertEqual(discovered["payload"]["url"], "https://trustees.uoregon.edu/packet.pdf")
            self.assertEqual(discovered["payload"]["discovered_from"], "https://trustees.uoregon.edu/meetings")

    def test_host_reservations_survive_restart_and_defer_jobs_without_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "state.sqlite"
            store = Store(path)
            self.assertEqual(store.reserve_host("example.com", 10, 5), 10)
            self.assertEqual(Store(path).reserve_host("example.com", 11, 5), 15)
            job_id = store.enqueue("collect", "a", {}, 10)
            job = store.claim(10, 10)
            store.defer(job_id, job["token"], 11, 20)
            self.assertIsNone(store.claim(19, 10))
            retry = store.claim(20, 10)
            self.assertEqual(retry["attempts"], 1)


if __name__ == "__main__":
    unittest.main()
