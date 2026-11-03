import tempfile
import unittest
from pathlib import Path
from blindspot.collect import extract_html
from blindspot.discovery import discover
from blindspot.store import Store
from blindspot.worker import seed, run_once
from blindspot.evidence import source_groups
from blindspot.embeds import story_from_script


class EmbedTests(unittest.TestCase):
    def test_story_and_its_parent_do_not_inflate_publisher_groups(self):
        parent = "https://news.uoregon.edu/example"
        story = "https://university-of-oregon-news.shorthandstories.com/example/"
        self.assertEqual(source_groups([{"url": parent, "content_hash": "a", "metadata": {}},
            {"url": story, "content_hash": "b", "metadata": {"embedded_from": parent}}]), 1)

    def test_only_explicit_newsroom_shorthand_embed_becomes_a_document_link(self):
        url = "https://news.uoregon.edu/example"
        story = "https://university-of-oregon-news.shorthandstories.com/example/"
        html = ('<head><title>An announcement | OregonNews</title></head><main><h1>An announcement</h1><script src="' + story + 'embed.js"></script></main>').encode()
        document = extract_html(html, url)
        self.assertEqual(document["embedded_documents"], [story])
        self.assertIn(story, document["links"])
        self.assertFalse(document["analysis_ready"])
        self.assertEqual(extract_html(html, "https://evil.example/")["embedded_documents"], [])

    def test_external_discovery_requires_exact_host_and_extractor_declared_embed(self):
        story = "https://university-of-oregon-news.shorthandstories.com/example/"
        source = {"url": "https://news.uoregon.edu/example", "category": "press_release"}
        self.assertEqual(discover(source, [story]), [])
        source["embedded_documents"] = [story]
        found = discover(source, [story])[0]
        self.assertEqual(found["embedded_from"], source["url"])
        self.assertEqual(found["category"], "press_release")
        self.assertEqual(found["publisher"], "University of Oregon")
        self.assertNotIn("embedded_documents", found)
        evil = story.replace(".com/", ".com.evil/")
        source["embedded_documents"] = [evil]
        self.assertEqual(discover(source, [evil]), [])

    def test_embed_count_and_script_url_acceptance_are_bounded(self):
        parent = "https://news.uoregon.edu/example"
        base = "https://university-of-oregon-news.shorthandstories.com"
        for script in [base + "/example/other.js", base + "/example/embed.js?token=x", base.replace("https:", "http:") + "/example/embed.js", base.replace(".com", ".com.evil") + "/example/embed.js"]:
            self.assertIsNone(story_from_script(parent, script))
        html = ('<main><h1>Example</h1>' + ''.join(f'<script src="{base}/story-{i}/embed.js"></script>' for i in range(8)) + '</main>').encode()
        self.assertEqual(len(extract_html(html, parent)["embedded_documents"]), 5)

    def test_embedding_provenance_does_not_spread_to_unrelated_child_links(self):
        source = {"url": "https://news.uoregon.edu/example", "embedded_from": "https://news.uoregon.edu/earlier"}
        child = discover(source, ["https://news.uoregon.edu/unrelated"])[0]
        self.assertNotIn("embedded_from", child)

    def test_worker_follows_embedded_body_while_retaining_headline_gap(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "research.sqlite")
            parent = "https://news.uoregon.edu/example"
            story = "https://university-of-oregon-news.shorthandstories.com/example/"
            seed(store, [{"url": parent, "category": "press_release"}], 10)
            result = run_once(store, 1, clock=lambda: 11, collector=lambda *args: {"version_id": 1, "url": parent, "analysis_ready": False, "links": [story], "embedded_documents": [story]})
            self.assertEqual(result["incomplete"], 1)
            self.assertEqual(result["discovered"], 1)
            job = store.claim(12, 10, kind="collect")
            self.assertEqual(job["payload"]["url"], story)
            self.assertEqual(job["payload"]["embedded_from"], parent)
            self.assertIsNone(store.claim(12, 10, kind="analyze"))
