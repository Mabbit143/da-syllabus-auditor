import { analysisProvider } from "./providers";

export interface SearchResult { url: string; snippet: string }
export interface AgentTool { name: string; description: string; parameters: Record<string, unknown> }
interface ToolCall { id: string; type: string; function: { name: string; arguments: string } }
interface ChatMessage { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }
class ProviderError extends Error {}
const META_URL = "https://api.meta.ai/v1/responses";
const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";

export function isBaseten(): boolean { return analysisProvider() === "baseten"; }

async function providerJson(provider: "Meta" | "Baseten", body: object): Promise<Record<string, unknown>> {
  const name = provider === "Meta" ? "MODEL_API_KEY" : "BASETEN_API_KEY";
  const key = process.env[name];
  if (!key) throw new ProviderError(`${name} is not set.`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider === "Meta" ? 55_000 : 110_000);
  try {
    const res = await fetch(provider === "Meta" ? META_URL : BASETEN_URL, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (!res.ok) throw new ProviderError(`${provider} returned HTTP ${res.status}. ${res.status === 429 ? "Usage is limited; retry later." : "Analysis could not be completed."}`);
    const data: unknown = await res.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new ProviderError(`${provider} response was invalid.`);
    return data as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError(`${provider} request failed or timed out. Please retry.`);
  } finally { clearTimeout(timer); }
}

interface MetaItem { type: string; content?: { type: string; text?: string }[]; results?: unknown[]; name?: string; arguments?: string; call_id?: string }
function metaItems(data: Record<string, unknown>): MetaItem[] {
  if (!Array.isArray(data.output) || !data.output.every((v) => v && typeof v === "object" && typeof v.type === "string")) throw new ProviderError("Meta response output was invalid.");
  return data.output;
}
function metaText(output: MetaItem[]): string {
  return output.filter((i) => i.type === "message").flatMap((i) => Array.isArray(i.content) ? i.content : [])
    .filter((c) => c && c.type === "output_text" && typeof c.text === "string").map((c) => c.text).join("");
}
function metaBody(instructions: string, input: unknown) {
  return { model: "muse-spark-1.3", instructions, input, store: false, reasoning: { effort: "low" }, temperature: 0, max_output_tokens: 6000 };
}

export async function callMeta(instructions: string, input: string): Promise<string> {
  if (isBaseten()) {
    const message = await basetenChat([{ role: "system", content: instructions }, { role: "user", content: input }]);
    if (typeof message.content !== "string" || !message.content.trim()) throw new ProviderError("Baseten response had no text output.");
    return message.content;
  }
  const output = metaItems(await providerJson("Meta", metaBody(instructions, input)));
  const text = metaText(output);
  if (!text.trim()) throw new ProviderError("Meta response had no text output.");
  return text;
}

/** Search always stays on Meta; there is no implicit cross-provider retry. */
export async function callMetaSearch(instructions: string, input: string): Promise<{ text: string; results: SearchResult[] }> {
  const output = metaItems(await providerJson("Meta", { ...metaBody(instructions, input), tools: [{ type: "web_search" }], include: ["web_search_call.results"] }));
  const text = metaText(output);
  if (!text.trim()) throw new ProviderError("Meta response had no text output.");
  const results = output.filter((i) => i.type === "web_search_call").flatMap((i) => Array.isArray(i.results) ? i.results : [])
    .filter((r): r is SearchResult => !!r && typeof r === "object" && typeof (r as SearchResult).url === "string" && typeof (r as SearchResult).snippet === "string");
  return { text, results };
}

async function basetenChat(messages: ChatMessage[], tools?: AgentTool[]): Promise<ChatMessage> {
  const data = await providerJson("Baseten", {
    model: "meta-models/muse-spark-open", messages, max_tokens: 30000, temperature: 0,
    ...(tools ? { tools: tools.map((t) => ({ type: "function", function: t })) } : {}),
  });
  const choices = data.choices;
  const message: unknown = Array.isArray(choices) ? choices[0]?.message : undefined;
  if (!message || typeof message !== "object") throw new ProviderError("Baseten response message was invalid.");
  const m = message as ChatMessage;
  if (m.content !== undefined && m.content !== null && typeof m.content !== "string") throw new ProviderError("Baseten response text was invalid.");
  if (m.tool_calls !== undefined && (!Array.isArray(m.tool_calls) || m.tool_calls.length > 32 || !m.tool_calls.every((c) => c && c.type === "function" && typeof c.id === "string" && c.function && typeof c.function.name === "string" && typeof c.function.arguments === "string"))) throw new ProviderError("Baseten response tools were invalid.");
  if (!m.content?.trim() && !m.tool_calls?.length) throw new ProviderError("Baseten response had no text or tools.");
  return { role: "assistant", content: m.content ?? null, ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) };
}

function invokeTool(name: string, args: string, tools: AgentTool[], run: (name: string, args: Record<string, unknown>) => string): string {
  try {
    const parsed: unknown = JSON.parse(args);
    if (!tools.some((t) => t.name === name) || !parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "Error: invalid tool call.";
    return run(name, parsed as Record<string, unknown>).slice(0, 6000);
  } catch { return "Error: tool execution failed."; }
}

export async function runAgent(instructions: string, task: string, tools: AgentTool[], run: (name: string, args: Record<string, unknown>) => string, maxTurns = 8): Promise<{ text: string; turns: number }> {
  const baseten = isBaseten();
  const chat: ChatMessage[] = [{ role: "system", content: instructions }, { role: "user", content: task }];
  const history: unknown[] = [{ role: "user", content: task }];
  let text = "";
  for (let turn = 1; turn <= maxTurns; turn++) {
    if (baseten) {
      const message = await basetenChat(chat, tools);
      chat.push(message);
      text = message.content ?? "";
      if (!message.tool_calls?.length) return { text, turns: turn };
      for (const call of message.tool_calls) chat.push({ role: "tool", tool_call_id: call.id, content: invokeTool(call.function.name, call.function.arguments, tools, run) });
    } else {
      const output = metaItems(await providerJson("Meta", { ...metaBody(instructions, history), tools: tools.map((t) => ({ type: "function", ...t })) }));
      history.push(...output);
      text = metaText(output);
      const calls = output.filter((i) => i.type === "function_call");
      if (!calls.length) {
        if (!text.trim()) throw new ProviderError("Meta response had no text or tools.");
        return { text, turns: turn };
      }
      for (const call of calls) {
        if (typeof call.call_id !== "string" || typeof call.name !== "string" || typeof call.arguments !== "string") throw new ProviderError("Meta response tools were invalid.");
        history.push({ type: "function_call_output", call_id: call.call_id, output: invokeTool(call.name, call.arguments, tools, run) });
      }
    }
  }
  return { text, turns: maxTurns };
}
