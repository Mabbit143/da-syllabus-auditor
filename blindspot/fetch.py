"""Bounded public HTTPS reads, including vetted external reporting sites."""
import ipaddress
import time
from urllib.parse import urljoin, urlsplit, urlunsplit

from document_jobs.download import PinnedHTTPS, public_addresses


class SourceHTTPError(ValueError):
    def __init__(self, status):
        self.status = status
        super().__init__(f"Source returned HTTP {status}")


def validate_url(url):
    if not isinstance(url, str) or len(url) > 4096 or any(ord(c) < 33 for c in url) or "\\" in url:
        raise ValueError("Invalid public source URL")
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Source must use public HTTPS without credentials")
    try:
        address = ipaddress.ip_address(parsed.hostname)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise ValueError("Source must have a public destination")
    return parsed


def canonical_url(url):
    parsed = validate_url(url)
    return urlunsplit(("https", parsed.netloc.lower(), parsed.path or "/", parsed.query, ""))


def fetch_public(url, *, max_bytes=5 * 1024 * 1024, timeout=30, transport=None, before_fetch=None):
    if type(max_bytes) is not int or not 1 <= max_bytes <= 20 * 1024 * 1024:
        raise ValueError("Download byte limit must be 1–20971520")
    if type(timeout) is not int or not 1 <= timeout <= 60:
        raise ValueError("Download timeout must be 1–60 seconds")
    current = canonical_url(url)
    deadline = time.monotonic() + timeout
    for _ in range(6):
        parsed = validate_url(current)
        if before_fetch:
            before_fetch(current)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError("Public document download timed out")
        addresses = public_addresses(parsed.hostname)
        target = parsed.path or "/"
        if parsed.query:
            target += "?" + parsed.query
        connection = None
        response = None
        try:
            if transport:
                response = transport(parsed.hostname, addresses[0], target, min(15, remaining))
            else:
                connection = PinnedHTTPS(parsed.hostname, addresses[0], min(15, remaining))
                connection.request("GET", target, headers={"User-Agent": "BlindspotEngine/1.0 (public institutional research)", "Accept-Encoding": "identity"})
                response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ValueError("Source redirect had no destination")
                current = canonical_url(urljoin(current, location))
                continue
            if response.status != 200:
                raise SourceHTTPError(response.status)
            if response.getheader("Content-Encoding", "identity").lower() not in ("", "identity"):
                raise ValueError("Compressed source response is unsupported")
            body = bytearray()
            while True:
                if time.monotonic() >= deadline:
                    raise ValueError("Public document download timed out")
                chunk = response.read(min(65536, max_bytes - len(body) + 1))
                if not chunk:
                    break
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise ValueError("Public document exceeds download byte limit")
            return {"url": current, "body": bytes(body), "content_type": response.getheader("Content-Type", "").split(";")[0].lower()}
        finally:
            if response and hasattr(response, "close"):
                response.close()
            if connection:
                connection.close()
    raise ValueError("Too many source redirects")
