"""Quiet entry point for a local scheduled worker; logs rotate inside private state."""
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import sys

from .cli import main


def service(argv=None):
    directory = Path(".blindspot")
    directory.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(directory / "monitor.log", maxBytes=2 * 1024 * 1024, backupCount=2, encoding="utf8")
    handler.setFormatter(logging.Formatter("%(asctime)s [blindspot] %(levelname)s %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
    # pythonw intentionally supplies no console streams.
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf8")
    logging.info("Local recurring worker starting")
    try:
        return main(["watch", *(sys.argv[1:] if argv is None else argv)])
    except KeyboardInterrupt:
        logging.info("Local recurring worker stopped")
        return 0
    except Exception:
        logging.error("Local recurring worker stopped unexpectedly; scheduled restart can recover expired leases")
        return 1


if __name__ == "__main__":
    sys.exit(service())
