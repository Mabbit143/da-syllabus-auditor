"""Local-only submission, collection and preview. No HTTP endpoints."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from .download import public_url

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/uo-policies/pdf/_index.json"
OUTPUT = ROOT / ".document-review"
APP = "da-public-policy-documents"


def manifest_urls(file=MANIFEST):
    data = json.loads(Path(file).read_text(encoding="utf8"))
    urls = set()
    for entries in data.values():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            url = entry.get("url") if isinstance(entry, dict) else None
            try:
                public_url(url)
                urls.add(url)
            except (ValueError, TypeError):
                pass
    return urls


def job_key(source, pages):
    return hashlib.sha256((source + "\n" + (pages or "all")).encode()).hexdigest()[:24]


def write_bundle(target, result):
    target = Path(target)
    if target.exists():
        raise FileExistsError("Job output already exists; inspect it instead of overwriting")
    for page in result.get("pages", []):
        if type(page.get("page")) is not int or page["page"] < 1:
            raise ValueError("Invalid result page")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".collect-", dir=target.parent))
    try:
        preview = ["# Public document review — not admitted policy evidence", "", f"Source: {result.get('sourceUrl', '')}", f"PDF SHA-256: {result.get('sourcePdfSha256', '')}", ""]
        for page in result.get("pages", []):
            image = page.pop("image", None)
            if image:
                content = base64.b64decode(image, validate=True)
                if len(content) > 2 * 1024 * 1024:
                    raise ValueError("Oversize review image")
                page["imageFile"] = f"page-{page['page']}.png"
                page["imageSha256"] = hashlib.sha256(content).hexdigest()
                (temporary / page["imageFile"]).write_bytes(content)
            preview.extend([f"## Page {page['page']} ({page.get('method', 'unknown')})", page.get("text", ""), f"Image: {page.get('imageFile', 'unavailable')}", ""])
        artifact = (json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf8")
        (temporary / "result.json").write_bytes(artifact)
        (temporary / "artifact.sha256").write_text(hashlib.sha256(artifact).hexdigest() + "\n", encoding="ascii")
        (temporary / "preview.md").write_text("\n".join(preview), encoding="utf8")
        temporary.rename(target)
    except BaseException:
        # Only remove this exact newly created temporary directory in the output parent.
        if temporary.parent == target.parent and temporary.name.startswith(".collect-"):
            shutil.rmtree(temporary)
        raise


def status():
    profile = Path(os.environ.get("MODAL_CONFIG_PATH", Path.home() / ".modal.toml"))
    return {"sdkInstalled": importlib.util.find_spec("modal") is not None, "profileFilePresent": profile.is_file(), "environmentCredentialsPresent": bool(os.environ.get("MODAL_TOKEN_ID") and os.environ.get("MODAL_TOKEN_SECRET")), "authenticatedAccess": "unverified", "credits": "unverified", "netSpendLimit": "unverified", "deployment": "unverified"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["status", "preview", "submit", "collect"])
    parser.add_argument("--source")
    parser.add_argument("--pages")
    parser.add_argument("--job")
    parser.add_argument("--credits-verified", action="store_true", help="Owner confirms applicable credits and a $0 net spend limit before submission")
    args = parser.parse_args()
    try:
        if args.command == "status":
            print(json.dumps(status(), indent=2))
            return
        OUTPUT.mkdir(exist_ok=True)
        if args.command in ("preview", "submit"):
            if args.source not in manifest_urls():
                raise ValueError("Choose a public URL from the bundled PDF manifest")
            identifier = job_key(args.source, args.pages)
            request = {"jobId": identifier, "sourceUrl": args.source, "pages": args.pages}
            print(json.dumps(request, indent=2))
            if args.command == "preview":
                return
            if not args.credits_verified:
                raise ValueError("Verify actual Modal credits and a $0 net spend limit, then pass --credits-verified")
            submitted = OUTPUT / f"{identifier}.submitted.json"
            # Reserve the key before any network operation, including concurrent CLI use.
            with submitted.open("x", encoding="utf8") as record:
                json.dump({**request, "state": "submitting"}, record)
            try:
                import modal
                function = modal.Function.from_name(APP, "process_document")
                call = function.spawn(identifier, args.source, args.pages, {})
                submitted.write_text(json.dumps({**request, "callId": call.object_id, "state": "queued"}), encoding="utf8")
            except Exception:
                submitted.write_text(json.dumps({**request, "state": "submission_failed"}), encoding="utf8")
                raise ValueError("Submission failed; check Modal authentication/deployment. Inspect the reserved job record before retrying.") from None
            print(f"Queued job {identifier}; collect with --job {identifier}")
        else:
            if not args.job or len(args.job) != 24 or any(c not in "0123456789abcdef" for c in args.job):
                raise ValueError("A valid local job ID is required")
            submitted = json.loads((OUTPUT / f"{args.job}.submitted.json").read_text(encoding="utf8"))
            import modal
            try:
                result = modal.FunctionCall.from_id(submitted["callId"]).get(timeout=0)
            except TimeoutError:
                print("Job is pending; collect again later.")
                return
            write_bundle(OUTPUT / args.job, result)
            print(f"Review bundle saved: .document-review/{args.job}/preview.md")
    except Exception as error:
        # Only locally created validation messages are safe; never print SDK internals.
        print(str(error) if isinstance(error, (ValueError, FileExistsError)) else "Document command failed; check local setup and job state.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
