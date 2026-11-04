import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { callMeta, callMetaSearch } from "../lib/meta.ts";
import { analysisProvider } from "../lib/providers.ts";

export function safeProviderCode(error) {
  const message = error instanceof Error ? error.message : "";
  const http = /^(?:Meta|Baseten) returned HTTP ([1-5][0-9]{2})\./.exec(message);
  if (http) return `provider_http_${http[1]}`;
  if (/^(?:MODEL_API_KEY|BASETEN_API_KEY) is not set\.$/.test(message)) return "provider_not_configured";
  if (/^(?:Meta|Baseten) request failed or timed out\./.test(message)) return "provider_unavailable";
  if (/^(?:Meta|Baseten) response (?:had no text (?:output|or tools)|(?:(?:output|message|text) )?was invalid|tools were invalid)\.$/.test(message) || message === "Research provider returned no usable text.") return "provider_response_invalid";
  return "provider_error";
}

export async function runModel(request, { creditsVerified = false, ask = callMeta, search = callMetaSearch, provider = analysisProvider() } = {}) {
  if (!creditsVerified) throw new Error("Verify provider credits and the no-out-of-pocket spending limit first.");
  if (!request || typeof request.instructions !== "string" || !request.instructions.trim() || request.instructions.length > 6000 || typeof request.input !== "string" || !request.input.trim() || request.input.length > 100000) {
    throw new Error("Invalid research model request.");
  }
  if (request.mode === "search") {
    const result = await search(request.instructions, request.input);
    // callMetaSearch supplies results only from actual web_search_call output.
    const results = result.results.filter((item) => typeof item.url === "string" && typeof item.snippet === "string").slice(0, 20);
    return { text: JSON.stringify({ search_confirmed: results.length > 0, results }), provider: "meta", fallback: false };
  }
  if (request.mode && request.mode !== "analysis") throw new Error("Invalid research model request mode.");
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
  } catch (error) {
    process.stderr.write(JSON.stringify({ error: { code: safeProviderCode(error) } }) + "\n");
    process.exitCode = 1;
  }
}
