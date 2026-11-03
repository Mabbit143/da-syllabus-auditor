import copy
import unittest

from blindspot.patterns import summarize


def record(number, quote, *, mechanism="Restrictive eligibility", url=None, status="review_lead"):
    return {"id": number, "report": {"findings": [{
        "id": "f1", "claim": "A reported restriction", "topic": "Access",
        "mechanism": mechanism, "status": status,
        "evidence": [{"role": "action", "quote": quote, "url": url or f"https://example.org/{number}", "version_id": number, "start": 0}],
    }], "observations": []}}


class PatternTests(unittest.TestCase):
    def test_copies_versions_and_transitive_shared_passages_do_not_inflate_groups(self):
        a = record(1, "The office rejected applications submitted after Friday.")
        b = record(2, "The office rejected applications submitted after\nFriday.")
        c = record(3, "A second action passage describes the same decision.")
        b["report"]["findings"][0]["evidence"] += c["report"]["findings"][0]["evidence"]
        result = summarize([a, b, c])
        self.assertEqual(len(result["evidence_groups"]), 1)
        self.assertEqual(len(result["evidence_groups"][0]["members"]), 3)
        self.assertEqual(result["mechanism_candidates"], [])

    def test_separate_passages_are_candidates_not_confirmed_incidents(self):
        rows = [record(1, "The office rejected late applications without exception."),
                record(2, "Applicants must pay the nonrefundable fee before review.")]
        result = summarize(rows)
        self.assertEqual(len(result["mechanism_candidates"]), 1)
        self.assertEqual(result["mechanism_candidates"][0]["status"], "incident_identity_unverified")
        self.assertEqual(len(result["mechanism_candidates"][0]["group_ids"]), 2)

    def test_policy_observations_missing_actions_and_dismissed_leads_are_excluded(self):
        row = record(1, "The office rejected late applications without exception.")
        row["report"]["observations"] = copy.deepcopy(row["report"]["findings"])
        no_action = record(2, "A commitment to access.")
        no_action["report"]["findings"][0]["evidence"][0]["role"] = "policy"
        reviews = [{"id": 2, "report_id": 1, "finding_id": "f1", "status": "dismissed"},
                   {"id": 1, "report_id": 1, "finding_id": "f1", "status": "follow_up"}]
        self.assertEqual(summarize([row, no_action], reviews)["evidence_groups"], [])

    def test_order_does_not_change_ids_or_mutate_reports(self):
        rows = [record(1, "First distinct administrative action passage."), record(2, "Second distinct administrative action passage.", status="unresolved")]
        original = copy.deepcopy(rows)
        self.assertEqual(summarize(rows), summarize(list(reversed(rows))))
        self.assertEqual(rows, original)
        self.assertEqual(summarize(rows)["evidence_groups"][1]["members"][0]["status"], "unresolved")


if __name__ == "__main__":
    unittest.main()
