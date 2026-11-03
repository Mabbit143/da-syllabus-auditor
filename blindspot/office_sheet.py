"""Stored spreadsheet values with explicit sheet/row/cell and formula provenance."""
import re
from .office_xml import S, R, TextParts


def _string(element):
    if element is None:
        return ""
    if element.tag == S + "rPh":
        return ""
    if element.tag == S + "t":
        return element.text or ""
    return "".join(_string(child) for child in element)


def extract_sheet(package):
    book = package.xml("xl/workbook.xml")
    sheets = book.find(S + "sheets")
    if sheets is None or not 1 <= len(sheets) <= 100:
        raise ValueError("Workbook has no supported sheets or exceeds the 100-sheet limit")
    relations = package.relationships("xl/_rels/workbook.xml.rels")
    strings = []
    if "xl/sharedStrings.xml" in package.names:
        strings = [_string(item) for item in package.xml("xl/sharedStrings.xml").findall(S + "si")]
    output, missing, cells_read = TextParts(), 0, 0
    names = set()
    for sheet in sheets:
        name, relation = sheet.get("name"), relations.get(sheet.get(R + "id"))
        if not name or name in names or not relation or not relation.get("Type", "").endswith("/worksheet"):
            raise ValueError("Workbook sheet relationship is unsupported or ambiguous")
        names.add(name)
        path = package.target("xl", relation)
        rows = package.xml(path).find(S + "sheetData")
        if rows is None:
            raise ValueError("Workbook sheet has no supported cell data")
        seen_rows = set()
        for row in rows.findall(S + "row"):
            number = row.get("r", "")
            if not number.isdigit() or not 1 <= int(number) <= 1048576 or number in seen_rows:
                raise ValueError("Workbook row locator is missing or ambiguous")
            seen_rows.add(number)
            values, cells, seen, cell_start = [], [], set(), 0
            for cell in row.findall(S + "c"):
                cells_read += 1
                ref = cell.get("r", "")
                match = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]{0,6})", ref)
                if not match or match[2] != number or ref in seen or cells_read > 250000:
                    raise ValueError("Workbook cell locator is missing, ambiguous or excessive")
                column = 0
                for char in match[1]:
                    column = column * 26 + ord(char) - ord("A") + 1
                if column > 16384:
                    raise ValueError("Workbook column locator exceeds worksheet limits")
                seen.add(ref)
                value = cell.findtext(S + "v", "")
                kind = cell.get("t", "n")
                if kind == "s":
                    if not value.isdigit() or int(value) >= len(strings):
                        raise ValueError("Workbook shared string index is invalid")
                    value = strings[int(value)]
                elif kind == "inlineStr":
                    value = _string(cell.find(S + "is"))
                elif kind not in ("n", "b", "e", "str", "d"):
                    raise ValueError("Workbook has an unsupported cell type")
                formula = cell.find(S + "f")
                if formula is not None and not value:
                    missing += 1
                cells.append({"cell": ref, "type": kind, "formula": formula.text if formula is not None else None, "cached": formula is not None, "value_present": bool(value), "style_index": cell.get("s"), "start": cell_start, "end": cell_start + len(value)})
                values.append(value)
                cell_start += len(value) + 1
            output.add("\t".join(values), kind="spreadsheet_row", label=f"Sheet {name}, row {number}", sheet=name, row=int(number), hidden=sheet.get("state", "visible") != "visible" or row.get("hidden") in ("1", "true"), cells=cells)
    return dict(output.document("xlsx-values", "Stored workbook values by sheet/row/cell; formulas not recalculated and cached results may be stale. Number/date/percent formats, merged-cell layout, charts, images, comments and external workbooks are not rendered or fetched. Raw boolean values are 0/1. Hidden sheets/rows are flagged; hidden columns and formula dependencies are not reconstructed."), missing_formula_values=missing)
