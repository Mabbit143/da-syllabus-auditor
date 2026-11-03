import io
from pathlib import Path
import unittest

from blindspot.pdf import extract_pdf


class PDFTests(unittest.TestCase):
    def test_native_packet_over_twenty_pages_retains_every_page(self):
        import pypdfium2 as pdfium
        source = Path(__file__).resolve().parents[2] / "e2e" / "fixtures" / "syllabus.pdf"
        buffer = io.BytesIO()
        with pdfium.PdfDocument(source) as template, pdfium.PdfDocument.new() as packet:
            for _ in range(21):
                packet.import_pages(template, [0])
            packet.save(buffer)
        result = extract_pdf(buffer.getvalue())
        self.assertEqual(result["pageCount"], 21)
        self.assertEqual([row["page"] for row in result["pages"]], list(range(1, 22)))
        self.assertTrue(all(row["method"] == "text" and len(row["text"]) > 20 for row in result["pages"]))

    def test_image_only_or_corrupt_pdf_requires_review(self):
        import pypdfium2 as pdfium
        buffer = io.BytesIO()
        with pdfium.PdfDocument.new() as blank:
            blank.new_page(200, 200).close()
            blank.save(buffer)
        with self.assertRaisesRegex(ValueError, "reviewed OCR"):
            extract_pdf(buffer.getvalue())
        with self.assertRaisesRegex(ValueError, "read PDF"):
            extract_pdf(b"%PDF-corrupt")


if __name__ == "__main__":
    unittest.main()
