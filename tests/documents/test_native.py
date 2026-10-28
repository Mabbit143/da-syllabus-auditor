import io
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from document_jobs.extract import process_document, _page
from document_jobs.download import Limits


class NativeExtractionTests(unittest.TestCase):
    def test_real_readable_pdf_extracts_text_and_page_image(self):
        source = Path(__file__).resolve().parents[2] / "e2e/fixtures/syllabus.pdf"
        result = process_document(source.read_bytes(), "https://provost.uoregon.edu/synthetic.pdf")
        self.assertEqual(result["status"], "ready_for_review")
        self.assertEqual(result["pages"][0]["method"], "text")
        self.assertGreater(len(result["pages"][0]["text"]), 20)
        self.assertGreater(len(result["pages"][0]["image"]), 20)

    def test_corrupt_pdf_fails_plainly(self):
        with self.assertRaisesRegex(ValueError, "corrupt or encrypted"):
            process_document(b"%PDF-this is not a real PDF", "https://provost.uoregon.edu/synthetic.pdf")

    def test_scanned_pdf_rendering_uses_ocr_word_boxes(self):
        __import__("pypdfium2")  # Load native platform detection before mocking the OCR subprocess.
        from PIL import Image, ImageDraw
        image = Image.new("RGB", (400, 200), "white")
        ImageDraw.Draw(image).text((20, 20), "Students may request accommodations.", fill="black")
        buffer = io.BytesIO()
        image.save(buffer, format="PDF")
        tsv = b"level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t20\t20\t40\t15\t98\tStudents\n5\t1\t1\t1\t1\t2\t65\t20\t30\t15\t95\tmay\n"
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "scan.pdf"
            file.write_bytes(buffer.getvalue())
            with patch("document_jobs.extract.subprocess.run", return_value=SimpleNamespace(stdout=tsv)):
                result = _page(str(file), 1, Limits())
            self.assertEqual(result["method"], "ocr")
            self.assertEqual(result["text"], "Students may")
            self.assertEqual(result["words"][0]["box"], [20, 20, 40, 15])
