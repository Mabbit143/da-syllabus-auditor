import unittest
from document_jobs.extract import page_selection, checked_dimensions, process_document
from document_jobs.download import Limits


class ExtractTests(unittest.TestCase):
    def test_explicit_page_ranges_and_no_truncation(self):
        self.assertEqual(page_selection("1,3-4", 8, 20), [1, 3, 4])
        for selection, total in [(None, 21), ("0", 5), ("6", 5), ("3-1", 5)]:
            with self.assertRaises(ValueError):
                page_selection(selection, total, 20)

    def test_pixel_limit_before_rendering(self):
        self.assertEqual(checked_dimensions(72, 72, Limits()), (200, 200))
        with self.assertRaises(ValueError):
            checked_dimensions(10000, 10000, Limits())

    def test_text_ocr_partial_and_provenance(self):
        calls = []

        def page(index, remaining):
            calls.append(index)
            if index == 3:
                raise ValueError("synthetic unreadable page")
            return {"page": index, "method": "text" if index == 1 else "ocr", "text": "Policy text", "image": "c3ludGhldGlj", "words": []}

        result = process_document(b"%PDF-synthetic", "https://provost.uoregon.edu/policy.pdf", 3, "1-3", page_runner=page)
        self.assertEqual(result["status"], "partial")
        self.assertEqual([p["method"] for p in result["pages"]], ["text", "ocr", "failed"])
        self.assertEqual(len(result["sourcePdfSha256"]), 64)
        self.assertEqual(calls, [1, 2, 3])

    def test_deadline_stops_work_with_explicit_pages(self):
        clock = [0]

        def page(index, remaining):
            clock[0] += 301
            return {"page": index, "method": "text", "text": "Policy", "image": "", "words": []}

        result = process_document(b"%PDF-synthetic", "https://provost.uoregon.edu/policy.pdf", 2, None, page_runner=page, clock=lambda: clock[0])
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["pages"][1]["method"], "failed")


if __name__ == "__main__":
    unittest.main()
