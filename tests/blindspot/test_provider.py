import json
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from blindspot.provider import NodeModel


class ProviderTests(unittest.TestCase):
    def test_credit_gate_prevents_any_subprocess(self):
        with patch("blindspot.provider.subprocess.run") as run:
            with self.assertRaisesRegex(ValueError, "credits"):
                NodeModel(credits_verified=False)
        run.assert_not_called()

    def test_call_budget_and_provider_metadata(self):
        with patch("blindspot.provider.subprocess.run", return_value=SimpleNamespace(stdout=json.dumps({"text": '{"findings":[]}', "provider": "meta", "fallback": False}))) as run:
            model = NodeModel(credits_verified=True, max_calls=1)
            self.assertEqual(model("instructions", "input"), '{"findings":[]}')
            self.assertEqual(model.calls, [{"provider": "meta", "fallback": False}])
            with self.assertRaisesRegex(ValueError, "budget"):
                model("instructions", "input")
            self.assertEqual(run.call_count, 1)
            self.assertIn("--credits-verified", run.call_args.args[0])

    def test_windows_node_process_does_not_open_a_console(self):
        model = NodeModel(credits_verified=True)
        response = SimpleNamespace(stdout=json.dumps({"text": '{"findings":[]}', "provider": "baseten", "fallback": False}))
        with patch("blindspot.provider.sys.platform", "win32"), patch("blindspot.provider.subprocess.CREATE_NO_WINDOW", 0x08000000, create=True), patch("blindspot.provider.subprocess.run", return_value=response) as run:
            model("instructions", "input")
        self.assertEqual(run.call_args.kwargs.get("creationflags"), 0x08000000)

    def test_provider_failure_does_not_echo_secret_or_document(self):
        error = subprocess.CalledProcessError(1, ["node"], stderr="SECRET DOCUMENT TEXT")
        with patch("blindspot.provider.subprocess.run", side_effect=error):
            with self.assertRaisesRegex(ValueError, "provider failed") as context:
                NodeModel(credits_verified=True)("instructions", "input")
        self.assertNotIn("SECRET", str(context.exception))

    def test_sanitized_provider_status_is_preserved_for_retry_diagnostics(self):
        error = subprocess.CalledProcessError(1, ["node"], stderr='{"error":{"code":"provider_http_429"}}')
        with patch("blindspot.provider.subprocess.run", side_effect=error):
            with self.assertRaises(ValueError) as context:
                NodeModel(credits_verified=True)("instructions", "input")
        self.assertEqual(context.exception.code, "provider_http_429")


if __name__ == "__main__":
    unittest.main()
