import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
try { if (existsSync(".env.local")) process.loadEnvFile(".env.local"); }
catch { process.stderr.write("Could not read local configuration.\n"); process.exit(1); }
const selected = process.env.MODEL_PROVIDER?.trim() || "meta";
if (!["meta", "baseten"].includes(selected)) { process.stderr.write("MODEL_PROVIDER must be meta or baseten.\n"); process.exit(1); }
process.stdout.write(JSON.stringify({
  analysis: selected, research: "meta", documents: "modal",
  keys: { meta: Boolean(process.env.MODEL_API_KEY), baseten: Boolean(process.env.BASETEN_API_KEY) },
  modal: { profileFilePresent: existsSync(process.env.MODAL_CONFIG_PATH || join(homedir(), ".modal.toml")), environmentCredentialsPresent: Boolean(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET) },
  liveChecks: { authenticatedAccess: "unverified", creditBalances: "unverified", spendControls: "unverified", basetenPrivacyTerms: "unverified", modalDeployment: "unverified" },
}, null, 2) + "\n");
