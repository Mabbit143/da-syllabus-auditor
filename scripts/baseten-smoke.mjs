import { existsSync } from "node:fs";
if (!process.argv.includes("--credits-verified")) {
  process.stderr.write("Verify the Baseten grant balance and no out-of-pocket billing before using --credits-verified.\n");
  process.exit(1);
}
try { if (existsSync(".env.local")) process.loadEnvFile(".env.local"); }
catch { process.stderr.write("Local configuration could not be read.\n"); process.exit(1); }
if (!process.env.BASETEN_API_KEY) { process.stderr.write("BASETEN_API_KEY is missing.\n"); process.exit(1); }
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 110_000);
try {
  const response = await fetch("https://inference.baseten.co/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.BASETEN_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "meta-models/muse-spark-open-1026", messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 512, temperature: 0 }), signal: controller.signal,
  });
  if (!response.ok) throw new Error(`Baseten returned HTTP ${response.status}.`);
  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Baseten returned no usable text; no automatic retry was made.");
  process.stdout.write(JSON.stringify({ provider: "baseten", model: "meta-models/muse-spark-open-1026", authenticatedInference: true, syntheticOnly: true }) + "\n");
} catch (error) {
  const safe = error instanceof Error && /^(Baseten returned HTTP \d+\.|Baseten returned no usable text; no automatic retry was made\.)$/.test(error.message) ? error.message : "Baseten smoke test failed or timed out; no automatic retry was made.";
  process.stderr.write(safe + "\n"); process.exitCode = 1;
} finally { clearTimeout(timer); }
