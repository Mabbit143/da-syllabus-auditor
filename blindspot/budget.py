"""Persistent daily logical-call caps and reusable validated model steps."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import time


logger = logging.getLogger("blindspot")


class ModelBudgetExhausted(ValueError):
    def __init__(self, next_due):
        self.next_due = next_due
        super().__init__("Daily research model-call limit reached; remaining analysis is deferred")


class CachedBudgetModel:
    def __init__(self, store, ask, *, daily_limit=12, clock=time.time):
        if type(daily_limit) is not int or not 1 <= daily_limit <= 100:
            raise ValueError("Daily logical model-call limit must be 1–100")
        self.store, self.ask, self.daily_limit, self.clock = store, ask, daily_limit, clock
        self.calls = []

    def __call__(self, instructions, context):
        key = hashlib.sha256(json.dumps([instructions, context], ensure_ascii=False).encode("utf8")).hexdigest()
        now = self.clock()
        date = datetime.fromtimestamp(now, timezone.utc)
        day = date.date().isoformat()
        tomorrow = (date + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        with self.store._db() as db:
            cached = db.execute("SELECT response,provenance FROM model_cache WHERE key=?", (key,)).fetchone()
            if cached:
                self.calls.append(dict(json.loads(cached["provenance"]), cached=True))
                return json.loads(cached["response"])
            used = db.execute("SELECT calls FROM model_budget WHERE day=?", (day,)).fetchone()
            if used and used["calls"] >= self.daily_limit:
                raise ModelBudgetExhausted(tomorrow)
            db.execute("INSERT INTO model_budget(day,calls) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1", (day,))
        # Failed/timed-out requests still consume the reserved logical step.
        start = len(getattr(self.ask, "calls", []))
        raw = self.ask(instructions, context)
        field = "results" if instructions.startswith("DISCOVERY") else "reviews" if "SKEPTIC" in instructions else "incidents" if instructions.startswith("PATTERN_INVESTIGATOR") else "findings"
        try:
            result = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError as exc:
            stripped = raw.lstrip()
            shape = "empty" if not stripped else "fenced" if stripped.startswith("```") else "object" if stripped.startswith("{") else "array" if stripped.startswith("[") else "other"
            logger.error("Invalid model JSON: step=%s shape=%s characters=%s line=%s column=%s", field, shape, len(raw), exc.lineno, exc.colno)
            raise
        maximum = 20 if field == "results" else 15 if instructions.startswith("PATTERN_SKEPTIC") else 12 if field == "incidents" else 3
        if not isinstance(result, dict) or not isinstance(result.get(field), list) or len(result[field]) > maximum:
            raise ValueError("Research model returned an invalid step response")
        if field == "incidents" and (not isinstance(result.get("patterns"), list) or len(result["patterns"]) > 3):
            raise ValueError("Pattern model returned an invalid patterns list")
        provenance = getattr(self.ask, "calls", [])[start:]
        metadata = provenance[-1] if provenance else {"provider": "injected", "fallback": False}
        with self.store._db() as db:
            db.execute("INSERT OR IGNORE INTO model_cache(key,response,provenance,created_at) VALUES (?,?,?,?)", (key, json.dumps(result, ensure_ascii=False), json.dumps(metadata), now))
        self.calls.append(dict(metadata, cached=False))
        return result
