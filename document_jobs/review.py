"""Owner review receipts and preview-before-save policy admission."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
from .cli import ROOT, OUTPUT, manifest_urls
from .download import public_url

TOPICS = {"accommodations", "late_work", "attendance", "academic_integrity", "incompletes", "final_exams", "dead_week", "religious_observance", "grievances", "mandatory_reporting"}
ADMITTED = ROOT / "data/uo-policies/reviewed-ocr"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validated_bundle(bundle, page_number, manifest):
    bundle = Path(bundle)
    raw = (bundle / "result.json").read_bytes()
    if len(raw) > 16 * 1024 * 1024 or digest(raw) != (bundle / "artifact.sha256").read_text().strip():
        raise ValueError("Review artifact hash changed")
    artifact = json.loads(raw)
    public_url(artifact.get("sourceUrl"))
    if artifact.get("sourceUrl") not in manifest or artifact.get("version") != 1 or not re.fullmatch(r"[0-9a-f]{64}", artifact.get("sourcePdfSha256", "")):
        raise ValueError("Invalid source provenance")
    pages = artifact.get("pages", [])
    matches = [p for p in pages if p.get("page") == page_number]
    if len(matches) != 1 or matches[0].get("method") not in ("text", "ocr"):
        raise ValueError("No unique readable source page")
    page = matches[0]
    if page.get("imageFile") != f"page-{page_number}.png":
        raise ValueError("Invalid page image path")
    image = (bundle / page["imageFile"]).read_bytes()
    if len(image) > 2 * 1024 * 1024 or digest(image) != page.get("imageSha256"):
        raise ValueError("Review page image changed")
    from PIL import Image
    import io
    try:
        with Image.open(io.BytesIO(image)) as decoded:
            if decoded.format != "PNG" or decoded.size != (page.get("width"), page.get("height")) or decoded.width * decoded.height > 16_000_000:
                raise ValueError()
            decoded.verify()
    except Exception:
        raise ValueError("Invalid review page image") from None
    return raw, artifact, page, image


def prepare_receipt(bundle, topic, page_number, quote, region, *, confirmed=False, manifest=None):
    if not confirmed:
        raise ValueError("Owner must check the exact quoted words against the page image and confirm review")
    raw, artifact, page, image = validated_bundle(bundle, page_number, manifest if manifest is not None else manifest_urls())
    if topic not in TOPICS or not isinstance(quote, str) or not 40 <= len(quote) <= 700 or quote not in page.get("text", ""):
        raise ValueError("Topic or exact reviewed quote is invalid")
    if not isinstance(region, list) or len(region) != 4 or any(type(v) is not int or v < 0 for v in region):
        raise ValueError("Review region must be integer x,y,width,height")
    x, y, width, height = region
    if not width or not height or x + width > page["width"] or y + height > page["height"]:
        raise ValueError("Review region is outside the source image")
    result = {"version": 1, "approved": True, "topic": topic, "sourceUrl": artifact["sourceUrl"], "sourcePdfSha256": artifact["sourcePdfSha256"], "artifactSha256": digest(raw), "page": page_number, "region": region, "quote": quote, "imageSha256": digest(image), "extractionMethod": page["method"], "reviewedAt": datetime.now(timezone.utc).isoformat()}
    result["id"] = digest((result["sourcePdfSha256"] + topic + str(page_number) + quote).encode())
    return result


def import_receipt(bundle, receipt, target=ADMITTED, *, select=False, apply=False, manifest=None):
    if receipt.get("approved") is not True or receipt.get("version") != 1:
        raise ValueError("Only explicit owner-approved receipts can be imported")
    verified = prepare_receipt(bundle, receipt.get("topic"), receipt.get("page"), receipt.get("quote"), receipt.get("region"), confirmed=True, manifest=manifest)
    for key in ("id", "artifactSha256", "sourcePdfSha256", "sourceUrl", "imageSha256", "extractionMethod"):
        if verified[key] != receipt.get(key):
            raise ValueError("Review receipt does not match its source artifacts")
    try:
        reviewed_at = datetime.fromisoformat(receipt["reviewedAt"])
        if reviewed_at.tzinfo is None:
            raise ValueError()
    except (KeyError, ValueError, TypeError):
        raise ValueError("Review timestamp is invalid") from None
    record = {**receipt, "selected": bool(select)}
    if not apply:
        return record
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    lock = target / ".import.lock"
    with lock.open("x") as reservation:
        try:
            index_path = target / "index.json"
            index = json.loads(index_path.read_text(encoding="utf8")) if index_path.exists() else {"version": 1, "records": []}
            if index.get("version") != 1 or not isinstance(index.get("records"), list):
                raise ValueError("Admission manifest is invalid")
            records = [r for r in index["records"] if r["id"] != record["id"]]
            if select:
                for other in records:
                    if other["topic"] == record["topic"]:
                        other["selected"] = False
            records.append(record)
            artifacts = target / "artifacts"
            artifacts.mkdir(exist_ok=True)
            raw, _, _, image = validated_bundle(bundle, record["page"], manifest if manifest is not None else manifest_urls())
            for name, content in [(record["artifactSha256"] + ".json", raw), (record["imageSha256"] + ".png", image)]:
                file = artifacts / name
                if file.exists() and digest(file.read_bytes()) != digest(content):
                    raise ValueError("Existing admitted artifact differs")
                if not file.exists():
                    with file.open("xb") as output:
                        output.write(content)
            temporary = target / "index.next.json"
            with temporary.open("x", encoding="utf8") as output:
                json.dump({"version": 1, "records": records}, output, indent=2, ensure_ascii=False)
                output.write("\n")
            temporary.replace(index_path)
        finally:
            reservation.close()
            lock.unlink(missing_ok=True)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["preview", "approve", "import"])
    parser.add_argument("--bundle", required=True, help="24-character local job ID")
    parser.add_argument("--topic", choices=sorted(TOPICS))
    parser.add_argument("--page", type=int)
    parser.add_argument("--quote-file", default="quote.txt", help="Filename inside the bundle")
    parser.add_argument("--region", help="x,y,width,height in rendered-image pixels")
    parser.add_argument("--confirm-reviewed", action="store_true")
    parser.add_argument("--receipt", help="Approval record ID printed by approve")
    parser.add_argument("--select", action="store_true", help="Explicitly replace this topic's selected source")
    parser.add_argument("--apply", action="store_true", help="Save the previewed admission")
    args = parser.parse_args()
    try:
        if not re.fullmatch(r"[0-9a-f]{24}", args.bundle):
            raise ValueError("Invalid bundle ID")
        bundle = OUTPUT / args.bundle
        if args.command == "preview":
            print((bundle / "preview.md").read_text(encoding="utf8"))
        elif args.command == "approve":
            if Path(args.quote_file).name != args.quote_file:
                raise ValueError("Quote file must be inside the review bundle")
            quote = (bundle / args.quote_file).read_text(encoding="utf8").strip()
            region = [int(value) for value in (args.region or "").split(",")]
            receipt = prepare_receipt(bundle, args.topic, args.page, quote, region, confirmed=args.confirm_reviewed)
            with (bundle / f"approval-{receipt['id']}.json").open("x", encoding="utf8") as file:
                json.dump(receipt, file, indent=2)
            print(json.dumps(receipt, indent=2))
        else:
            if not re.fullmatch(r"[0-9a-f]{64}", args.receipt or ""):
                raise ValueError("A valid approval record ID is required")
            receipt = json.loads((bundle / f"approval-{args.receipt}.json").read_text(encoding="utf8"))
            print(json.dumps(import_receipt(bundle, receipt, select=args.select, apply=args.apply), indent=2))
    except Exception as error:
        print(str(error) if isinstance(error, ValueError) else "Review command failed; inspect the local bundle and receipt.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
