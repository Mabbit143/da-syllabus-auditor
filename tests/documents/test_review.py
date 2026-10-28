import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from document_jobs.review import prepare_receipt, import_receipt

URL = "https://provost.uoregon.edu/policy.pdf"
QUOTE = "Students must be told the attendance requirements and how absences affect grades."


def bundle(directory):
    from PIL import Image
    root = Path(directory) / "bundle"
    root.mkdir()
    image = root / "page-1.png"
    Image.new("RGB", (100, 100), "white").save(image)
    result = {"version": 1, "sourceUrl": URL, "sourcePdfSha256": "a" * 64, "fetchedAt": "2026-10-27T00:00:00Z", "pages": [{"page": 1, "method": "ocr", "text": QUOTE, "width": 100, "height": 100, "imageFile": image.name, "imageSha256": hashlib.sha256(image.read_bytes()).hexdigest()}]}
    artifact = (json.dumps(result) + "\n").encode()
    (root / "result.json").write_bytes(artifact)
    (root / "artifact.sha256").write_text(hashlib.sha256(artifact).hexdigest())
    return root


class ReviewTests(unittest.TestCase):
    def test_preview_does_not_save_and_explicit_import_preserves_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = bundle(directory)
            receipt = prepare_receipt(root, "attendance", 1, QUOTE, [0, 0, 100, 100], confirmed=True, manifest={URL})
            target = Path(directory) / "admitted"
            preview = import_receipt(root, receipt, target, select=True, apply=False, manifest={URL})
            self.assertFalse(target.exists())
            self.assertTrue(preview["selected"])
            import_receipt(root, receipt, target, select=True, apply=True, manifest={URL})
            index = json.loads((target / "index.json").read_text())
            self.assertEqual(index["records"][0]["quote"], QUOTE)
            self.assertTrue((target / "artifacts" / (receipt["artifactSha256"] + ".json")).exists())

    def test_review_confirmation_quote_region_and_topic_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            root = bundle(directory)
            cases = [("attendance", QUOTE, [0, 0, 100, 100], False), ("unknown", QUOTE, [0, 0, 100, 100], True), ("attendance", "Invented passage of sufficient length for a quote.", [0, 0, 100, 100], True), ("attendance", QUOTE, [90, 90, 100, 100], True)]
            for topic, quote, region, confirmed in cases:
                with self.assertRaises(ValueError):
                    prepare_receipt(root, topic, 1, quote, region, confirmed=confirmed, manifest={URL})

    def test_changed_artifact_or_image_fails_before_import(self):
        for changed in ("result.json", "page-1.png"):
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as directory:
                root = bundle(directory)
                receipt = prepare_receipt(root, "attendance", 1, QUOTE, [0, 0, 100, 100], confirmed=True, manifest={URL})
                file = root / changed
                file.write_bytes(file.read_bytes() + b"tampered")
                with self.assertRaises(ValueError):
                    import_receipt(root, receipt, Path(directory) / "admitted", apply=True, manifest={URL})

    def test_unreviewed_and_changed_quote_cannot_be_imported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = bundle(directory)
            receipt = prepare_receipt(root, "attendance", 1, QUOTE, [0, 0, 100, 100], confirmed=True, manifest={URL})
            for change in ({"approved": False}, {"quote": "Completely fabricated source passage with no documentary support."}):
                with self.assertRaises(ValueError):
                    import_receipt(root, {**receipt, **change}, Path(directory) / "admitted", apply=True, manifest={URL})
