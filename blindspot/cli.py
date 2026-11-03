"""Run with python -m blindspot.cli; live analysis requires verified credits."""
import argparse
import json
import logging
from pathlib import Path
import sys
import time

from .store import Store
from .worker import run_once, seed
from .corpus import import_corpus
from .analyze import run_analysis
from .provider import NodeModel
from .budget import CachedBudgetModel
from .monitor import cycle, watch
from .search import discover_web, replay_discovery
from .synthesis import enqueue_synthesis, run_synthesis


def main(argv=None):
    parser = argparse.ArgumentParser(description="Private Blindspot research collection")
    parser.add_argument("command", choices=["collect", "status", "import-corpus", "analyze", "synthesize", "cycle", "watch", "discover", "replay-discovery"])
    parser.add_argument("--db", default=".blindspot/research.sqlite")
    parser.add_argument("--sources", default=str(Path(__file__).with_name("sources.json")))
    parser.add_argument("--max-jobs", type=int, default=3)
    parser.add_argument("--credits-verified", action="store_true")
    parser.add_argument("--daily-model-calls", type=int, default=12)
    parser.add_argument("--interval", type=int, default=600)
    parser.add_argument("--max-cycles", type=int)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="[blindspot] %(message)s")
    try:
        store = Store(args.db)
        if args.command == "synthesize":
            model = CachedBudgetModel(store, NodeModel(credits_verified=args.credits_verified, max_calls=2), daily_limit=args.daily_model_calls)
            enqueue_synthesis(store, time.time())
            result = run_synthesis(store, model)
            print(json.dumps(result, indent=2))
            return 1 if result["failed"] else 0
        if args.command == "replay-discovery":
            print(json.dumps(replay_discovery(store), indent=2))
            return 0
        if args.command == "discover":
            model = CachedBudgetModel(store, NodeModel(credits_verified=args.credits_verified, max_calls=1, mode="search"), daily_limit=args.daily_model_calls)
            result = discover_web(store, model)
            print(json.dumps(result, indent=2))
            return 1 if result["state"] in ("failed", "unconfirmed") else 0
        if args.command == "analyze":
            if not 1 <= args.max_jobs <= 10:
                raise ValueError("Analysis pass must process 1–10 jobs")
            model = CachedBudgetModel(store, NodeModel(credits_verified=args.credits_verified, max_calls=2 * args.max_jobs), daily_limit=args.daily_model_calls)
            result = run_analysis(store, model, max_jobs=args.max_jobs)
            print(json.dumps(result, indent=2))
            return 1 if result["failed"] else 0
        if args.command == "import-corpus":
            result = import_corpus(store, Path(__file__).resolve().parent.parent / "data" / "uo-policies", time.time())
            print(json.dumps(result, indent=2))
            return 1 if result["failed"] else 0
        if args.command in ("collect", "cycle", "watch"):
            sources = json.loads(Path(args.sources).read_text(encoding="utf-8-sig"))
            if not isinstance(sources, list) or not all(isinstance(source, dict) and isinstance(source.get("url"), str) for source in sources):
                raise ValueError("Source registry must be a list of objects with URLs")
            if args.command == "collect":
                seed(store, sources, time.time())
                result = run_once(store, args.max_jobs)
            else:
                factory = (lambda: CachedBudgetModel(store, NodeModel(credits_verified=True, max_calls=2), daily_limit=args.daily_model_calls)) if args.credits_verified else None
                search_factory = (lambda: CachedBudgetModel(store, NodeModel(credits_verified=True, max_calls=1, mode="search"), daily_limit=args.daily_model_calls)) if args.credits_verified else None
                options = {"interval": args.interval, "max_jobs": args.max_jobs, "ask_factory": factory, "search_factory": search_factory}
                if args.command == "watch":
                    result = watch(store, sources, max_cycles=args.max_cycles, runner="verification" if args.max_cycles is not None else "scheduled", **options)
                else:
                    result = cycle(store, sources, **options)
            print(json.dumps(result, indent=2))
            return 1 if result.get("failed") or result.get("state") == "failed" or result.get("last", {}).get("state") == "failed" else 0
        print(json.dumps(store.status(), indent=2))
        return 0
    except Exception as exc:
        logging.error("Research command failed: %s", str(exc) or type(exc).__name__)
        return 1


if __name__ == "__main__":
    sys.exit(main())
