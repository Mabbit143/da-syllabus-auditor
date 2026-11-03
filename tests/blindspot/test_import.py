import tempfile
import unittest
from pathlib import Path

from blindspot.corpus import import_corpus
from blindspot.store import Store


class CorpusTests(unittest.TestCase):
    def test_import_preserves_original_date_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            corpus = root / "corpus"
            corpus.mkdir()
            (corpus / "001-policy.md").write_text("# Policy title\n\nSource: https://policies.uoregon.edu/policy\nFetched: 2026-10-27\nFound from: seed\n\nPublic policy text with requirements.\n", encoding="utf8")
            store = Store(root / "state.sqlite")
            result = import_corpus(store, corpus, 100)
            self.assertEqual(result["imported"], 1)
            import_corpus(store, corpus, 101)
            rows = store.history("https://policies.uoregon.edu/policy")
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["metadata"]["original_fetched_date"], "2026-10-27")
            self.assertTrue(rows[0]["metadata"]["archived_snapshot"])
            self.assertEqual(rows[0]["text"], "Public policy text with requirements.")
            self.assertEqual(store.status()["jobs"][0]["count"], 1)

    def test_invalid_sources_and_legacy_pdf_text_are_not_imported(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            corpus = root / "corpus"
            corpus.mkdir()
            (corpus / "bad.md").write_text("Source: https://evil.example/a\nFetched: 2026-10-27\nFound from: seed\n\nWrong institution", encoding="utf8")
            (corpus / "pdf").mkdir()
            (corpus / "pdf" / "scan.md").write_text("unreviewed scan", encoding="utf8")
            store = Store(root / "state.sqlite")
            result = import_corpus(store, corpus, 100)
            self.assertEqual(result["imported"], 0)
            self.assertEqual(result["failed"], 1)
            self.assertEqual(store.status()["documents"], 0)

    def test_old_import_cannot_replace_a_live_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            corpus = root / "corpus"
            corpus.mkdir()
            url = "https://policies.uoregon.edu/policy"
            (corpus / "policy.md").write_text(f"# Policy\n\nSource: {url}\nFetched: 2026-10-27\nFound from: seed\n\nOld policy", encoding="utf8")
            store = Store(root / "state.sqlite")
            store.snapshot(url, "Live policy", {"method": "html"}, 99)
            result = import_corpus(store, corpus, 100)
            self.assertEqual(result["skipped"], 1)
            self.assertEqual(store.history(url)[-1]["text"], "Live policy")


if __name__ == "__main__":
    unittest.main()
