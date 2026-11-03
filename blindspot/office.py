"""Isolated, bounded native DOCX/XLSX extraction; never execute Office content."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile
from xml.etree.ElementTree import ParseError

from .office_xml import Package
from .office_word import extract_word
from .office_sheet import extract_sheet


def extract_package(data):
    package = None
    try:
        package = Package(data)
        if "word/document.xml" in package.names and "xl/workbook.xml" not in package.names:
            return extract_word(package)
        if "xl/workbook.xml" in package.names and "word/document.xml" not in package.names:
            return extract_sheet(package)
        raise ValueError("Not a supported DOCX or XLSX package")
    except (zipfile.BadZipFile, ParseError, UnicodeError, KeyError, RuntimeError) as exc:
        raise ValueError("Office document is corrupt, encrypted or uses unsupported XML") from exc
    finally:
        if package is not None:
            package.archive.close()


def extract_office(data):
    if not isinstance(data, bytes) or not data.startswith(b"PK\x03\x04") or len(data) > 20 * 1024 * 1024:
        raise ValueError("Not a supported DOCX or XLSX document")
    try:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "source.zip"
            path.write_bytes(data)
            process = subprocess.run([sys.executable, "-m", "blindspot.office", str(path)], cwd=Path(__file__).resolve().parent.parent, capture_output=True, text=True, encoding="utf8", timeout=30, check=True)
            return json.loads(process.stdout)
    except (subprocess.SubprocessError, OSError, ValueError) as exc:
        raise ValueError("Could not read Office document within research limits; it may be corrupt, encrypted, unsupported or too large") from exc


if __name__ == "__main__":
    try:
        if sys.platform != "win32":
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
        print(json.dumps(extract_package(Path(sys.argv[1]).read_bytes()), ensure_ascii=False))
    except Exception:
        print("Office text extraction failed", file=sys.stderr)
        sys.exit(1)
