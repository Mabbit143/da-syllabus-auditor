import tempfile
import unittest
from pathlib import Path

from blindspot.store import Store
from blindspot.synthesis import build_input, enqueue_synthesis, run_synthesis, latest_synthesis
from blindspot.budget import CachedBudgetModel


class SynthesisTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "state.sqlite")
        self.add_lead("Applications received after Friday were rejected.", "f1", 10)
        self.add_lead("Applicants without a paid deposit could not enroll.", "f2", 20)

    def tearDown(self):
        self.temp.cleanup()

    def add_lead(self, quote, name, now):
        version = self.store.snapshot(f"https://uoregon.edu/{name}", quote, {"published_at": "2025-03-01", "category": "administration"}, now)
        evidence = dict(version_id=version, url=f"https://uoregon.edu/{name}", content_hash=self.store.get_version(version)["content_hash"], quote=quote, start=0, end=len(quote), page=None, role="action")
        self.store.enqueue("analyze", name, {"version_id": version}, now)
        job = self.store.claim(now, 60, kind="analyze")
        self.store.complete_analysis(job["id"], job["token"], now + 1, {"schema_version": 2, "findings": [{"id": name, "claim": quote, "topic": "Access", "mechanism": "Eligibility", "status": "review_lead", "temporal_scope": "Historical 2025 record", "questions": ["Were exceptions available?"], "evidence": [evidence], "skeptic": {"reason": "Limited lead; no outcome proven.", "counterevidence": []}}], "observations": []})

    def response(self, context):
        a, b = context["leads"][:2]
        incidents = [{"id": f"i{index}", "summary": lead["claim"], "basis": "allegation", "mechanism_code": "eligibility_barrier", "lead_ids": [lead["id"]], "evidence_ids": [lead["evidence_ids"][0]], "temporal_scope": "2025 source; current applicability unknown", "distinctness": "Different described administrative decisions; verify underlying event."} for index, lead in enumerate([a, b], 1)]
        return {"incidents": incidents, "patterns": [{"id": "p1", "claim": "Two reported access barriers warrant comparison.", "kind": "recurring_mechanism", "mechanism_code": "eligibility_barrier", "incident_ids": ["i1", "i2"], "policy_evidence_ids": [], "temporal_scope": "Historical records only", "questions": ["Are these separate decisions?"]}]}

    def ask(self, instructions, context):
        import json
        data = json.loads(context)
        if "SKEPTIC" not in instructions:
            return self.response(data)
        return {"reviews": [{"id": item["id"], "decision": "unresolved", "reason": "Attribution and incident identity need review.", "distinctness": "Possible separate decisions, not established origins.", "temporal_scope": "Historical only", "alternative_explanations": ["Different wording could concern one event."], "counterevidence_ids": []} for item in data["proposals"]["incidents"] + data["proposals"]["patterns"]]}

    def test_model_incidents_patterns_and_skeptic_keep_allegations_unresolved(self):
        self.assertTrue(enqueue_synthesis(self.store, 30))
        result = run_synthesis(self.store, self.ask, clock=lambda: 31)
        self.assertEqual(result["completed"], 1)
        saved = latest_synthesis(self.store)
        self.assertEqual(len(saved["report"]["incidents"]), 2)
        pattern = saved["report"]["patterns"][0]
        self.assertEqual(pattern["status"], "unresolved")
        self.assertEqual(pattern["basis"], "allegation_only")
        self.assertFalse(pattern["publication_eligible"])
        self.assertTrue(saved["input_current"])
        self.assertFalse(enqueue_synthesis(self.store, 32))

    def test_unknown_evidence_and_repeated_incidents_cannot_support_pattern(self):
        def invalid(instructions, raw):
            import json
            if "SKEPTIC" in instructions:
                return self.ask(instructions, raw)
            result = self.response(json.loads(raw))
            result["incidents"][1]["evidence_ids"] = ["made-up-citation"]
            return result
        enqueue_synthesis(self.store, 30)
        run_synthesis(self.store, invalid, clock=lambda: 31)
        report = latest_synthesis(self.store)["report"]
        self.assertEqual(len(report["incidents"]), 1)
        self.assertEqual(report["patterns"], [])
        self.assertGreaterEqual(report["rejected_count"], 2)

    def test_shared_action_passages_cannot_be_split_into_two_incidents(self):
        def duplicate(instructions, raw):
            import json
            if "SKEPTIC" in instructions:
                return self.ask(instructions, raw)
            result = self.response(json.loads(raw))
            result["incidents"][1] = dict(result["incidents"][0], id="i2")
            return result
        enqueue_synthesis(self.store, 30)
        run_synthesis(self.store, duplicate, clock=lambda: 31)
        self.assertEqual(latest_synthesis(self.store)["report"]["patterns"], [])

    def test_budget_deferral_reuses_investigator_after_restart(self):
        enqueue_synthesis(self.store, 30)
        calls = []
        def ask(*args):
            calls.append(args[0])
            return self.ask(*args)
        model = CachedBudgetModel(self.store, ask, daily_limit=1, clock=lambda: 31)
        self.assertEqual(run_synthesis(self.store, model, clock=lambda: 31)["budget_deferred"], 1)
        next_day = CachedBudgetModel(Store(self.store.path), ask, daily_limit=1, clock=lambda: 86431)
        self.assertEqual(run_synthesis(self.store, next_day, clock=lambda: 86431)["completed"], 1)
        self.assertEqual(len(calls), 2)
        self.assertTrue(latest_synthesis(self.store)["report"]["model_calls"][0]["cached"])

    def test_new_owner_dismissal_marks_snapshot_stale_and_changes_next_input(self):
        enqueue_synthesis(self.store, 30)
        run_synthesis(self.store, self.ask, clock=lambda: 31)
        from blindspot.app import query
        query(self.store, {"action": "review", "report_id": 1, "finding_id": "f1", "status": "dismissed", "note": "Same underlying incident", "actor": "verified-owner"}, now=32)
        self.assertFalse(latest_synthesis(self.store)["input_current"])
        self.assertEqual(len(build_input(self.store)["leads"]), 1)

    def test_forged_saved_offsets_are_not_supplied_as_verified_evidence(self):
        with self.store._db() as db:
            row = db.execute("SELECT report FROM analyses WHERE id=1").fetchone()
            import json
            report = json.loads(row["report"])
            report["findings"][0]["evidence"][0]["start"] = 1
            db.execute("UPDATE analyses SET report=? WHERE id=1", (json.dumps(report),))
        self.assertEqual(len(build_input(self.store)["leads"]), 1)

    def test_skeptic_rejection_removes_dependent_pattern(self):
        def reject(instructions, raw):
            result = self.ask(instructions, raw)
            if "SKEPTIC" in instructions:
                result["reviews"][0]["decision"] = "reject"
            return result
        enqueue_synthesis(self.store, 30)
        run_synthesis(self.store, reject, clock=lambda: 31)
        self.assertEqual(latest_synthesis(self.store)["report"]["patterns"], [])

    def test_policy_gap_without_policy_quote_is_rejected(self):
        def gap(instructions, raw):
            result = self.ask(instructions, raw)
            if "SKEPTIC" not in instructions:
                result["patterns"][0]["kind"] = "policy_practice_gap"
            return result
        enqueue_synthesis(self.store, 30)
        run_synthesis(self.store, gap, clock=lambda: 31)
        self.assertEqual(latest_synthesis(self.store)["report"]["patterns"], [])

    def test_stale_pattern_worker_cannot_persist_after_lease_recovery(self):
        from blindspot.synthesis_state import complete
        enqueue_synthesis(self.store, 30)
        stale = self.store.claim(31, 10, kind="synthesize")
        current = self.store.claim(41, 10, kind="synthesize")
        with self.assertRaises(ValueError):
            complete(self.store, stale, 42, {})
        self.assertIsNone(latest_synthesis(self.store))
        complete(self.store, current, 42, {"incidents": [], "patterns": []})
        self.assertIsNotNone(latest_synthesis(self.store))

    def test_monitor_runs_due_pattern_pass_and_preserves_source_analysis_for_later(self):
        from blindspot.monitor import cycle
        result = cycle(self.store, [], interval=10, clock=lambda: 30,
            collect_pass=lambda *args, **kwargs: {"collected": 0, "failed": 0},
            analyze_pass=lambda *args, **kwargs: self.fail("Pattern pass should take this cycle's research slot"),
            ask_factory=lambda: self.ask)
        self.assertEqual(result["analysis"]["pattern_completed"], 1)
        self.assertIsNotNone(latest_synthesis(self.store))

    def test_context_limit_omits_whole_leads_and_discloses_coverage(self):
        import json
        with self.store._db() as db:
            row = db.execute("SELECT report FROM analyses WHERE id=1").fetchone()
            report = json.loads(row["report"])
            report["findings"][0]["questions"] = ["\U0001f600" * 10000]
            db.execute("UPDATE analyses SET report=? WHERE id=1", (json.dumps(report),))
        context = build_input(self.store)
        self.assertLess(len(json.dumps(context)), 60000)
        self.assertEqual(context["coverage"]["omitted_leads"], 1)
        self.assertEqual(len(context["leads"]), 1)
        self.assertEqual(len(context["evidence"]), 1)

    def test_malformed_pattern_lists_are_not_cached(self):
        from blindspot.synthesis_contract import INVESTIGATOR
        model = CachedBudgetModel(self.store, lambda *args: {"incidents": []}, daily_limit=1, clock=lambda: 31)
        with self.assertRaises(ValueError):
            model(INVESTIGATOR, "source context")
        with self.store._db() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM model_cache").fetchone()[0], 0)

    def dismiss_first(self, now=32):
        from blindspot.app import query
        query(self.store, {"action": "review", "report_id": 1, "finding_id": "f1", "status": "dismissed", "note": "Same underlying incident; exclude this lead.", "actor": "verified-owner"}, now=now)

    def test_owner_dismissal_supersedes_pending_snapshot_without_a_model_call(self):
        from blindspot.synthesis import synthesis_due
        enqueue_synthesis(self.store, 30)
        self.dismiss_first()
        self.assertFalse(enqueue_synthesis(self.store, 33))
        self.assertFalse(synthesis_due(self.store, 33))
        result = run_synthesis(self.store, lambda *args: self.fail("Dismissed input must not reach a model"), clock=lambda: 33)
        self.assertEqual(result["completed"], 0)
        with self.store._db() as db:
            self.assertEqual(db.execute("SELECT state FROM jobs WHERE kind='synthesize'").fetchone()[0], "superseded")

    def test_new_leads_replace_pending_input_without_rewriting_its_history(self):
        enqueue_synthesis(self.store, 30)
        with self.store._db() as db:
            old = dict(db.execute("SELECT * FROM jobs WHERE kind='synthesize'").fetchone())
        self.add_lead("A third distinct administrative decision was reported.", "f3", 31)
        self.assertTrue(enqueue_synthesis(self.store, 33))
        with self.store._db() as db:
            rows = [dict(row) for row in db.execute("SELECT * FROM jobs WHERE kind='synthesize' ORDER BY id")]
        self.assertEqual([r["state"] for r in rows], ["superseded", "pending"])
        self.assertEqual(rows[0]["payload"], old["payload"])

    def test_active_lease_is_preserved_then_expired_stale_input_is_superseded(self):
        from blindspot.synthesis_state import complete
        enqueue_synthesis(self.store, 30)
        job = self.store.claim(31, 10, kind="synthesize")
        self.dismiss_first()
        self.assertFalse(enqueue_synthesis(self.store, 33))
        with self.store._db() as db:
            self.assertEqual(db.execute("SELECT state FROM jobs WHERE id=?", (job["id"],)).fetchone()[0], "running")
        self.assertFalse(enqueue_synthesis(self.store, 41))
        with self.store._db() as db:
            self.assertEqual(db.execute("SELECT state FROM jobs WHERE id=?", (job["id"],)).fetchone()[0], "superseded")
        with self.assertRaises(ValueError):
            complete(self.store, job, 42, {})

    def test_direct_runner_rechecks_owner_review_before_any_model_call(self):
        enqueue_synthesis(self.store, 30)
        self.dismiss_first()
        result = run_synthesis(self.store, lambda *args: self.fail("Stale input reached a model"), clock=lambda: 33)
        self.assertEqual(result["superseded"], 1)
        self.assertIsNone(latest_synthesis(self.store))

    def test_review_change_between_model_steps_prevents_skeptic_and_save(self):
        enqueue_synthesis(self.store, 30)
        calls = []
        def change(instructions, context):
            calls.append(instructions)
            result = self.ask(instructions, context)
            self.dismiss_first()
            return result
        result = run_synthesis(self.store, change, clock=lambda: 33)
        self.assertEqual(result["superseded"], 1)
        self.assertEqual(len(calls), 1)
        self.assertIsNone(latest_synthesis(self.store))

    def test_review_change_during_skeptic_prevents_saving_stale_output(self):
        enqueue_synthesis(self.store, 30)
        def change(instructions, context):
            result = self.ask(instructions, context)
            if "SKEPTIC" in instructions:
                self.dismiss_first()
            return result
        result = run_synthesis(self.store, change, clock=lambda: 33)
        self.assertEqual(result["superseded"], 1)
        self.assertIsNone(latest_synthesis(self.store))


if __name__ == "__main__":
    unittest.main()
