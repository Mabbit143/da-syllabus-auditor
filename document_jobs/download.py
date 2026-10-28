"""Bounded public-UO downloads with DNS pinned at the actual TLS connection."""
from dataclasses import dataclass
import http.client
import ipaddress
import socket
import ssl
import time
from urllib.parse import urljoin, urlsplit


@dataclass(frozen=True)
class Limits:
    max_bytes: int = 20 * 1024 * 1024
    max_pages: int = 20
    dpi: int = 200
    max_pixels: int = 16_000_000
    timeout: int = 300

    def __post_init__(self):
        maximums = dict(max_bytes=20 * 1024 * 1024, max_pages=20, dpi=200, max_pixels=16_000_000, timeout=300)
        for name, maximum in maximums.items():
            value = getattr(self, name)
            if type(value) is not int or not 1 <= value <= maximum:
                raise ValueError(f"Invalid {name}; limits may only be lowered")


def public_url(url):
    if not isinstance(url, str) or any(ord(c) < 33 for c in url) or "\\" in url:
        raise ValueError("Invalid source URL")
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443) or not (host == "uoregon.edu" or host.endswith(".uoregon.edu")):
        raise ValueError("Only public HTTPS UO source URLs are accepted")
    return parsed


def public_addresses(host):
    addresses = sorted({entry[4][0] for entry in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)})
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("Source resolved to a non-public destination")
    return addresses


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, address, timeout):
        super().__init__(host, timeout=timeout, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        # No second DNS lookup: the already validated address is the destination.
        sock = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except BaseException:
            sock.close()
            raise


def download_pdf(url, manifest, limits=None, *, transport=None):
    limits = limits or Limits()
    if url not in manifest:
        raise ValueError("Source is not in the bundled corpus manifest")
    deadline = time.monotonic() + limits.timeout
    current = url
    for _ in range(6):
        parsed = public_url(current)
        addresses = public_addresses(parsed.hostname)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError("Document download timed out")
        connection = None
        try:
            if transport:
                response = transport(parsed.hostname, addresses[0], min(15, remaining))
            else:
                connection = PinnedHTTPS(parsed.hostname, addresses[0], min(15, remaining))
                target = parsed.path or "/"
                if parsed.query:
                    target += "?" + parsed.query
                connection.request("GET", target, headers={"User-Agent": "DA-Syllabus-Auditor/1.0 (public policy research)", "Accept-Encoding": "identity"})
                response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ValueError("Redirect lacked a destination")
                current = urljoin(current, location)
                public_url(current)
                continue
            if response.status != 200:
                raise ValueError(f"Source returned HTTP {response.status}")
            chunks, size = [], 0
            while True:
                if time.monotonic() >= deadline:
                    raise ValueError("Document download timed out")
                chunk = response.read(min(65536, limits.max_bytes - size + 1))
                if not chunk:
                    break
                size += len(chunk)
                if size > limits.max_bytes:
                    raise ValueError("Source exceeds the download byte limit")
                chunks.append(chunk)
            data = b"".join(chunks)
            if not data.startswith(b"%PDF-"):
                raise ValueError("Source did not return a PDF")
            return data
        finally:
            if connection:
                connection.close()
    raise ValueError("Too many source redirects")
