"""Bounded OOXML package reads. Never unpack or resolve external resources."""
import io
import posixpath
import zipfile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
P = "{http://schemas.openxmlformats.org/package/2006/relationships}"


class Package:
    def __init__(self, data):
        if not isinstance(data, bytes) or len(data) > 20 * 1024 * 1024:
            raise ValueError("Office source exceeds the research size limit")
        self.archive = zipfile.ZipFile(io.BytesIO(data))
        entries = self.archive.infolist()
        names = [entry.filename for entry in entries]
        if len(entries) > 2000 or len(names) != len(set(names)) or sum(entry.file_size for entry in entries) > 20 * 1024 * 1024:
            raise ValueError("Office archive exceeds research package limits")
        for entry in entries:
            if entry.filename.startswith("/") or "\\" in entry.filename or ".." in entry.filename.split("/") or entry.flag_bits & 1 or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) or entry.file_size > max(1, entry.compress_size) * 200 or "vbaproject" in entry.filename.lower():
                raise ValueError("Office archive contains unsupported or excessive package data")
        self.names = set(names)
        if "[Content_Types].xml" not in self.names:
            raise ValueError("Not a supported Office package")

    def xml(self, name):
        info = self.archive.getinfo(name)
        if info.file_size > 16 * 1024 * 1024:
            raise ValueError("Office XML part exceeds the research extraction limit")
        data = self.archive.read(name)
        text = data.decode("utf-16" if data.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")
        if "\x00" in text or "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
            raise ValueError("Office XML declarations and entity expansion are not supported")
        return ET.fromstring(text)

    def relationships(self, path):
        result = {}
        if path in self.names:
            for item in self.xml(path).findall(P + "Relationship"):
                key = item.get("Id")
                if not key or key in result:
                    raise ValueError("Office package has ambiguous relationships")
                result[key] = dict(item.attrib)
        return result

    def target(self, base, relation):
        target = relation.get("Target", "")
        if relation.get("TargetMode") == "External" or ":" in target or "\\" in target or not target:
            raise ValueError("Office data references an unsupported external part")
        path = posixpath.normpath(target.lstrip("/") if target.startswith("/") else posixpath.join(base, target))
        if path.startswith("../") or path not in self.names:
            raise ValueError("Office package references a missing or invalid part")
        return path


class TextParts:
    def __init__(self):
        self.parts, self.locations, self.cursor = [], [], 0

    def add(self, text, **location):
        if not text.strip():
            return
        if self.cursor + len(text) > 4000000 or len(self.locations) >= 50000:
            raise ValueError("Office text exceeds research extraction limits")
        self.parts.append(text)
        self.locations.append(dict(location, start=self.cursor, end=self.cursor + len(text)))
        self.cursor += len(text) + 2

    def document(self, method, coverage):
        if not self.parts:
            raise ValueError("Could not read text from this Office document")
        return {"text": "\n\n".join(self.parts), "locations": self.locations, "title": "", "published_at": None, "links": [], "method": method, "coverage": coverage}
