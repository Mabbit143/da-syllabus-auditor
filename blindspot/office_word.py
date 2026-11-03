"""Native Word body/table and referenced story text; no rendered-page claims."""
from .office_xml import W, R, TextParts


def _text(element):
    if element.tag in (W + "del", W + "moveFrom", W + "instrText"):
        return ""
    if element.tag == W + "r":
        hidden = element.find(W + "rPr/" + W + "vanish")
        if hidden is not None and hidden.get(W + "val", "true") not in ("0", "false", "off"):
            return ""
    if element.tag == W + "t":
        return element.text or ""
    if element.tag in (W + "tab", W + "br", W + "cr"):
        return "\t" if element.tag == W + "tab" else "\n"
    return "".join(_text(child) for child in element)


def extract_word(package):
    root = package.xml("word/document.xml")
    body = root.find(W + "body")
    if body is None:
        raise ValueError("Word document has no supported body text")
    output = TextParts()

    def story(element, name):
        paragraphs = tables = 0

        def walk(node):
            nonlocal paragraphs, tables
            for child in node:
                if child.tag in (W + "del", W + "moveFrom"):
                    continue
                if child.tag == W + "p":
                    paragraphs += 1
                    output.add(_text(child), kind="word_paragraph", part=name, label=f"Word {name}, paragraph {paragraphs}")
                elif child.tag == W + "tbl":
                    tables += 1
                    for number, row in enumerate(child.findall(W + "tr"), 1):
                        cells = ["\n".join(_text(p) for p in cell.iter(W + "p")) for cell in row.findall(W + "tc")]
                        output.add("\t".join(cells), kind="word_table_row", part=name, label=f"Word {name}, table {tables}, row {number}")
                else:
                    walk(child)
        walk(element)

    story(body, "body")
    relations = package.relationships("word/_rels/document.xml.rels")
    visited = set()
    for tag in ("headerReference", "footerReference"):
        for reference in body.iter(W + tag):
            relation = relations.get(reference.get(R + "id"))
            if not relation:
                raise ValueError("Word document references a missing header or footer")
            part = package.target("word", relation)
            if part not in visited:
                story(package.xml(part), part)
                visited.add(part)
    for kind in ("footnote", "endnote"):
        ids = {item.get(W + "id") for item in body.iter(W + kind + "Reference")}
        if ids:
            part = f"word/{kind}s.xml"
            if part not in package.names:
                raise ValueError("Word document references missing notes")
            found = set()
            for note in package.xml(part).findall(W + kind):
                note_id = note.get(W + "id")
                if note_id in ids:
                    story(note, f"{kind} {note_id}")
                    found.add(note_id)
            if found != ids:
                raise ValueError("Word document has missing referenced notes")
    return output.document("docx-text", "Native Word body paragraphs, table rows and referenced headers/footers/notes; not rendered pages. Deleted/hidden runs, comments, images, embedded files, field instructions and layout are not analyzed; merged-cell layout is not reconstructed. Field result text is stored text, not recalculated.")
