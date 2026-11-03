import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { callMeta } from "../lib/meta.ts";
import { analysisProvider } from "../lib/providers.ts";

export async function runModel(request, { creditsVerified = false, ask = callMeta, provider = analysisProvider() } = {}) {
  if (!creditsVerified) throw new Error("Verify provider credits and the no-out-of-pocket spending limit first.");
  if (!request || typeof request.instructions !== "string" || !request.instructions.trim() || request.instructions.length > 6000 || typeof request.input !== "string" || !request.input.trim() || request.input.length > 100000) {
    throw new Error("Invalid research model request.");
  }
  let fallback = false;
  const text = await ask(request.instructions, request.input, () => { fallback = true; });
  if (typeof text !== "string" || !text.trim()) throw new Error("Research provider returned no usable text.");
  return { text, provider: fallback ? "baseten" : provider, fallback };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv.includes("--credits-verified")) throw new Error("Provider credits must be verified before analysis.");
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 512000) throw new Error("Research request is too large.");
      chunks.push(chunk);
    }
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    process.stdout.write(JSON.stringify(await runModel(request, { creditsVerified: true })));
  } catch {
    process.stderr.write("Research provider failed or request did not validate; no source text or credentials were logged.\n");
    process.exitCode = 1;
  }
}
