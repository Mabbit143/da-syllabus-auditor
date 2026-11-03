import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from blindspot.office import extract_office, extract_package
from blindspot.collect import collect
from blindspot.store import Store
from blindspot.evidence import verify_evidence

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
P = "http://schemas.openxmlformats.org/package/2006/relationships"


def package(parts):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        for name, text in parts.items():
            archive.writestr(name, text)
    return stream.getvalue()


def word():
    return package({"word/document.xml": f'''<w:document xmlns:w="{W}"><w:body>
      <w:p><w:r><w:t>University of Oregon </w:t></w:r><w:r><w:t>eligibility requirements.</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Applications</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Due Friday</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:del><w:r><w:delText>Deleted restriction</w:delText></w:r></w:del><w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden restriction</w:t></w:r><w:r><w:t>Published revised requirement.</w:t></w:r></w:p>
    </w:body></w:document>'''})


def workbook():
    return package({
        "xl/workbook.xml": f'<workbook xmlns="{S}" xmlns:r="{R}"><sheets><sheet name="Aid Budget" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": f'<Relationships xmlns="{P}"><Relationship Id="rId1" Type="{R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/sharedStrings.xml": f'<sst xmlns="{S}"><si><t>University of Oregon</t></si><si><r><t>Student </t></r><r><t>aid allocation</t></r></si></sst>',
        "xl/worksheets/sheet1.xml": f'''<worksheet xmlns="{S}"><sheetData>
          <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Recorded budget values</t></is></c></row>
          <row r="3"><c r="A3" t="s"><v>1</v></c><c r="C3"><v>100</v></c><c r="D3"><f>C3*2</f><v>200</v></c></row>
        </sheetData></worksheet>''',
    })


class OfficeTests(unittest.TestCase):
    def test_word_body_table_rows_and_locations_keep_source_text(self):
        document = extract_package(word())
        self.assertIn("University of Oregon eligibility requirements.", document["text"])
        self.assertIn("Applications\tDue Friday", document["text"])
        self.assertNotIn("Deleted restriction", document["text"])
        self.assertNotIn("Hidden restriction", document["text"])
        self.assertTrue(any("table 1, row 1" in item["label"] for item in document["locations"]))
        self.assertEqual(document["method"], "docx-text")
        for item in document["locations"]:
            self.assertTrue(document["text"][item["start"]:item["end"]].strip())

    def test_spreadsheet_shared_strings_sparse_cells_and_cached_formulas(self):
        document = extract_package(workbook())
        self.assertIn("Student aid allocation\t100\t200", document["text"])
        row = document["locations"][1]
        self.assertEqual(row["sheet"], "Aid Budget")
        self.assertEqual(row["row"], 3)
        self.assertEqual([cell["cell"] for cell in row["cells"]], ["A3", "C3", "D3"])
        self.assertEqual(row["cells"][2]["formula"], "C3*2")
        self.assertTrue(row["cells"][2]["cached"])
        self.assertIn("not recalculated", document["coverage"])
        self.assertNotIn("pages", document)

    def test_isolated_extraction_collects_and_quote_retains_office_locator(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            result = collect(store, {"url": "https://uoregon.edu/rules.docx"}, 10,
                fetch=lambda url: {"url": url, "body": word(), "content_type": "application/octet-stream"})
            version = store.get_version(result["version_id"])
            citation = verify_evidence({"version_id": version["id"], "quote": "Applications Due Friday", "role": "action"}, [version])
            self.assertIn("table 1, row 1", citation["source_locations"][0]["label"])
            self.assertIsNone(citation["page"])
            store.enqueue("analyze", "office", {"version_id": version["id"]}, 10)
            job = store.claim(10, 60, kind="analyze")
            store.complete_analysis(job["id"], job["token"], 11, {"schema_version": 2, "findings": [{"id": "f1", "claim": "An application deadline", "status": "review_lead", "evidence": [citation]}]})
            from blindspot.synthesis_input import build_input
            context = build_input(store)
            self.assertIn("not rendered pages", context["evidence"][0]["metadata"]["coverage"])
            self.assertEqual(context["evidence"][0]["metadata"]["method"], "docx-text")

    def test_external_relationships_are_never_followed(self):
        data = package({"xl/workbook.xml": f'<workbook xmlns="{S}" xmlns:r="{R}"><sheets><sheet name="External" r:id="rId1"/></sheets></workbook>',
            "xl/_rels/workbook.xml.rels": f'<Relationships xmlns="{P}"><Relationship Id="rId1" Type="{R}/worksheet" Target="https://127.0.0.1/private" TargetMode="External"/></Relationships>'})
        with self.assertRaises(ValueError):
            extract_package(data)

    def test_referenced_headers_and_footnotes_preserve_exception_text(self):
        data = package({
            "word/document.xml": f'<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body><w:p><w:r><w:t>Eligibility applies.</w:t><w:footnoteReference w:id="1"/></w:r></w:p><w:sectPr><w:headerReference r:id="header1"/></w:sectPr></w:body></w:document>',
            "word/_rels/document.xml.rels": f'<Relationships xmlns="{P}"><Relationship Id="header1" Type="{R}/header" Target="header1.xml"/></Relationships>',
            "word/header1.xml": f'<w:hdr xmlns:w="{W}"><w:p><w:r><w:t>Historical draft, not current policy.</w:t></w:r></w:p></w:hdr>',
            "word/footnotes.xml": f'<w:footnotes xmlns:w="{W}"><w:footnote w:id="1"><w:p><w:r><w:t>Exceptions may be requested without a fee.</w:t></w:r></w:p></w:footnote></w:footnotes>',
        })
        document = extract_package(data)
        self.assertIn("Historical draft, not current policy.", document["text"])
        self.assertIn("Exceptions may be requested without a fee.", document["text"])
        self.assertTrue(any(item.get("part") == "footnote 1" for item in document["locations"]))

    def test_utf16_entity_declarations_and_macro_packages_are_rejected(self):
        for parts in [{"word/document.xml": '<!DOCTYPE x [<!ENTITY x "expanded">]><x>&x;</x>'.encode("utf-16")},
                      {"word/document.xml": f'<w:document xmlns:w="{W}"/>', "word/vbaProject.bin": b"macro"}]:
            with self.assertRaises(ValueError):
                extract_package(package(parts))

    def test_malformed_entities_oversized_archives_and_unknown_packages_fail(self):
        for data in [b"PK\x03\x04corrupt", package({"word/document.xml": '<!DOCTYPE x [<!ENTITY x "expanded">]><x>&x;</x>'}),
                     package({"../word/document.xml": "<document/>"}), package({"word/document.xml": "x" * 5000000}),
                     package({"arbitrary.xml": "<data/>"})]:
            with self.subTest(size=len(data)), self.assertRaises(ValueError):
                extract_package(data)

    def test_missing_cached_formula_is_not_presented_as_a_value(self):
        data = workbook()
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            parts = {name: archive.read(name).decode() for name in archive.namelist() if name != "[Content_Types].xml"}
        parts["xl/worksheets/sheet1.xml"] = parts["xl/worksheets/sheet1.xml"].replace("<v>200</v>", "")
        document = extract_package(package(parts))
        self.assertNotIn("200", document["text"])
        self.assertEqual(document["missing_formula_values"], 1)
        self.assertEqual(document["locations"][1]["cells"][2]["formula"], "C3*2")

    def test_large_document_windows_and_locations_do_not_leak_full_metadata(self):
        from blindspot.app import query
        from blindspot.locations import source_locations
        from blindspot.analyze import _context
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            text = "x" * 2100000 + "\nVerified late-document administrative requirement."
            version = store.snapshot("https://uoregon.edu/large.xlsx", text, {"locations": [{"label": "Sheet Budget, row 20000", "start": 2100001, "end": len(text)}]}, 10)
            result = query(store, {"action": "document", "version_id": version, "start": 2100000})
            self.assertIn("Verified late-document", result["text"])
            self.assertNotIn("locations", result["metadata"])
            self.assertEqual(result["source_locations"]["items"][0]["label"], "Sheet Budget, row 20000")
            _, context, _ = _context(store, version)
            self.assertNotIn("locations", context["documents"][0]["metadata"])
        locations = {"locations": [{"label": "Sheet Budget, row 1", "start": 0, "end": 10000, "cells": [{"cell": f"A{n}", "start": n, "end": n + 1, "formula": "X" * 1000, "cached": True} for n in range(300)]}]}
        import json
        projection = source_locations(locations, [(0, 10000)])
        self.assertLess(len(json.dumps(projection["items"])), 6001)
        self.assertGreater(projection["items"][0]["omitted_cells"], 0)


if __name__ == "__main__":
    unittest.main()
