"""Bounded bridge to the app's existing Meta/Baseten provider configuration."""
import json
from pathlib import Path
import subprocess
import re


class ResearchProviderError(ValueError):
    def __init__(self, code="provider_error"):
        allowed = {"provider_error", "provider_timeout", "provider_unavailable", "provider_not_configured", "provider_response_invalid"}
        self.code = code if isinstance(code, str) and (code in allowed or re.fullmatch(r"provider_http_[1-5][0-9]{2}", code)) else "provider_error"
        super().__init__(f"Research provider failed ({self.code}); retry later")


class NodeModel:
    def __init__(self, *, credits_verified=False, max_calls=2, mode="analysis"):
        if credits_verified is not True:
            raise ValueError("Verify provider credits and no out-of-pocket spending before live analysis")
        if type(max_calls) is not int or not 1 <= max_calls <= 20:
            raise ValueError("Model call budget must be 1–20")
        if mode not in ("analysis", "search"):
            raise ValueError("Unsupported research provider mode")
        self.mode = mode
        self.max_calls = max_calls
        self.used = 0
        self.calls = []
        self.root = Path(__file__).resolve().parent.parent

    def __call__(self, instructions, context):
        if self.used >= self.max_calls:
            raise ValueError("Research model call budget exhausted")
        self.used += 1  # A failed request still consumes this pass's call budget.
        try:
            process = subprocess.run(
                ["node", "--import", "./test-support/register-typescript.mjs", "blindspot/model.mjs", "--credits-verified"],
                cwd=self.root, input=json.dumps({"mode": self.mode, "instructions": instructions, "input": context}, ensure_ascii=False),
                capture_output=True, text=True, encoding="utf8", timeout=210, check=True,
            )
            output = json.loads(process.stdout)
            if output.get("provider") not in ("meta", "baseten") or not isinstance(output.get("text"), str):
                raise ValueError("Invalid provider envelope")
            self.calls.append({"provider": output["provider"], "fallback": bool(output.get("fallback"))})
            return output["text"]
        except subprocess.CalledProcessError as exc:
            try:
                diagnostic = json.loads((exc.stderr or "").strip().splitlines()[-1])
                code = diagnostic.get("error", {}).get("code")
            except (ValueError, IndexError, AttributeError):
                code = "provider_error"
            raise ResearchProviderError(code) from exc
        except subprocess.TimeoutExpired as exc:
            raise ResearchProviderError("provider_timeout") from exc
        except OSError as exc:
            raise ResearchProviderError("provider_unavailable") from exc
        except (ValueError, KeyError) as exc:
            raise ResearchProviderError("provider_response_invalid") from exc
