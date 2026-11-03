import tempfile
import unittest
from pathlib import Path

from blindspot.store import Store
from blindspot.quality import assess_text, coverage_summary
from blindspot.collect import collect
from blindspot.analyze import run_analysis, _context
from blindspot.app import query


class QualityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "state.sqlite")

    def tearDown(self):
        self.temp.cleanup()

    def test_exact_headline_only_html_is_partial_but_short_policy_text_is_eligible(self):
        self.assertEqual(assess_text("A university announcement", {"method": "html", "title": "A university announcement | OregonNews"})["state"], "headline_only")
        self.assertTrue(assess_text("Students may request an application fee waiver.", {"method": "html", "title": "Fee waiver policy"})["analysis_ready"])

    def test_collection_preserves_headline_record_without_claiming_article_body(self):
        source = {"url": "https://news.uoregon.edu/example", "category": "press_release"}
        html = b"<html><head><title>A university announcement | OregonNews</title></head><body><main><h1>A university announcement</h1></main></body></html>"
        result = collect(self.store, source, 10, fetch=lambda url: {"url": url, "body": html, "content_type": "text/html"})
        self.assertFalse(result["analysis_ready"])
        version = self.store.get_version(result["version_id"])
        self.assertEqual(version["text"], "A university announcement")
        self.assertIn("headline", version["metadata"]["coverage"])

    def test_legacy_headline_job_is_skipped_without_calling_model(self):
        version = self.store.snapshot("https://news.uoregon.edu/example", "A university announcement", {"method": "html", "title": "A university announcement | OregonNews"}, 10)
        self.store.enqueue("analyze", str(version), {"version_id": version}, 10)
        result = run_analysis(self.store, lambda *args: self.fail("Headline-only text reached a model"), clock=lambda: 11)
        self.assertEqual(result["skipped"], 1)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(self.store.analyses(), [])
        self.assertEqual(self.store.status()["jobs"][0]["state"], "skipped")

    def test_incomplete_related_sources_do_not_enter_model_context(self):
        self.store.snapshot("https://news.uoregon.edu/heading", "Application fee waiver requirements", {"title": "Application fee waiver requirements | News", "method": "html"}, 10)
        anchor = self.store.snapshot("https://uoregon.edu/fees", "Application fee waiver requirements are explained in this procedure.", {"method": "html", "title": "Fee procedure"}, 10)
        _, context, _ = _context(self.store, anchor)
        self.assertEqual(len(context["documents"]), 1)

    def test_coverage_counts_saved_categories_and_headlines_separately(self):
        self.store.snapshot("https://news.uoregon.edu/heading", "A university announcement", {"title": "A university announcement | OregonNews", "method": "html", "category": "press_release"}, 10)
        self.store.snapshot("https://uoregon.edu/policy", "Students may request an application fee waiver.", {"title": "Fee waivers", "method": "saved-web", "category": "policy", "archived_snapshot": True}, 10)
        summary = coverage_summary(self.store)
        self.assertEqual(summary["total_documents"], 2)
        self.assertEqual(summary["headline_only"], 1)
        self.assertEqual(summary["archived_snapshots"], 1)
        self.assertEqual(summary["categories"]["press_release"]["headline_only"], 1)
        result = query(self.store, {"action": "overview"})
        heading = next(item for item in result["documents"] if item["url"].endswith("heading"))
        self.assertFalse(heading["quality"]["analysis_ready"])
        self.assertEqual(result["coverage"]["headline_only"], 1)

    def test_worker_collects_placeholder_and_links_without_queuing_analysis(self):
        from blindspot.worker import run_once
        url = "https://news.uoregon.edu/example"
        self.store.enqueue("collect", "heading", {"url": url}, 10)
        def collector(store, source, now):
            return collect(store, source, now, fetch=lambda url: {"url": url, "content_type": "text/html", "body": b"<title>Headline without body | News</title><main><h1>Headline without body</h1></main>"})
        result = run_once(self.store, 1, clock=lambda: 11, collector=collector)
        self.assertEqual(result["incomplete"], 1)
        self.assertEqual(result["collected"], 1)
        self.assertFalse(any(job["kind"] == "analyze" for job in self.store.status()["jobs"]))

    def test_legacy_headline_findings_are_excluded_from_cross_report_input(self):
        from blindspot.synthesis_input import build_input
        text = "Headline without body"
        version = self.store.snapshot("https://news.uoregon.edu/example", text, {"method": "html", "title": text + " | News"}, 10)
        self.store.enqueue("analyze", str(version), {}, 10)
        job = self.store.claim(10, 60, kind="analyze")
        source = self.store.get_version(version)
        self.store.complete_analysis(job["id"], job["token"], 11, {"schema_version": 2, "findings": [{"id": "f1", "claim": "A headline claim", "status": "review_lead", "evidence": [{"version_id": version, "url": source["url"], "content_hash": source["content_hash"], "quote": text, "start": 0, "end": len(text), "role": "action", "page": None}]}]})
        self.assertEqual(build_input(self.store)["leads"], [])
        self.assertEqual(build_input(self.store)["coverage"]["invalid_evidence_leads"], 1)


if __name__ == "__main__":
    unittest.main()
