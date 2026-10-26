const BASE_URL = "https://api.meta.ai/v1";
const MODEL = "muse-spark-1.3"; // Standard mode only: never a -contributor ID.

export interface SearchResult {
  url: string;
  snippet: string;
}

export async function callMeta(instructions: string, input: string): Promise<string> {
  if (useBaseten()) return basetenText(instructions, input);
  return (await request(instructions, input, false)).text;
}

/** Search-grounded call. Returns the model text plus the raw results it retrieved. */
export async function callMetaSearch(instructions: string, input: string) {
  return request(instructions, input, true);
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Tool-calling loop on the Responses API. With store:false the full item history is resent each turn.
 * `run` executes a tool and returns its text result. Stops when the model answers without a tool call.
 */
export async function runAgent(
  instructions: string,
  task: string,
  tools: AgentTool[],
  run: (name: string, args: Record<string, unknown>) => string,
  maxTurns = 8,
): Promise<{ text: string; turns: number }> {
  if (useBaseten()) return runAgentChat(instructions, task, tools, run, maxTurns);
  const key = process.env.MODEL_API_KEY;
  if (!key) throw new Error("MODEL_API_KEY is not set");
  const history: unknown[] = [{ role: "user", content: task }];
  let text = "";
  for (let turn = 1; turn <= maxTurns; turn++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch(`${BASE_URL}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          instructions,
          input: history,
          store: false,
          reasoning: { effort: "low" },
          temperature: 0,
          max_output_tokens: 6000,
          tools: tools.map((t) => ({ type: "function", ...t })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Meta API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const output: { type: string; content?: { type: string; text?: string }[]; name?: string; arguments?: string; call_id?: string }[] = data.output ?? [];
      history.push(...output);
      text = output
        .filter((i) => i.type === "message")
        .flatMap((m) => m.content ?? [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("");
      const calls = output.filter((i) => i.type === "function_call");
      if (calls.length === 0) return { text, turns: turn };
      for (const c of calls) {
        let out: string;
        try {
          out = run(c.name ?? "", JSON.parse(c.arguments || "{}"));
        } catch (err) {
          out = `Error: ${err instanceof Error ? err.message : "tool failed"}`;
        }
        history.push({ type: "function_call_output", call_id: c.call_id, output: out.slice(0, 6000) });
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return { text, turns: maxTurns };
}

async function request(instructions: string, input: string, search: boolean) {
  const key = process.env.MODEL_API_KEY;
  if (!key) throw new Error("MODEL_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const res = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input,
        store: false,
        reasoning: { effort: "low" },
        temperature: 0,
        max_output_tokens: 6000,
        ...(search ? { tools: [{ type: "web_search" }], include: ["web_search_call.results"] } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Meta API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = await res.json();
    const parts: string[] = [];
    const results: SearchResult[] = [];
    for (const item of data.output ?? []) {
      if (item.type === "web_search_call" && Array.isArray(item.results)) {
        for (const r of item.results) {
          if (typeof r?.url === "string" && typeof r?.snippet === "string") results.push({ url: r.url, snippet: r.snippet });
        }
      }
      if (item.type !== "message") continue;
      for (const c of item.content ?? []) {
        if (c.type === "output_text" && typeof c.text === "string") parts.push(c.text);
      }
    }
    if (parts.length === 0) throw new Error("Meta API response had no text output");
    return { text: parts.join(""), results };
  } finally {
    clearTimeout(timer);
  }
}

// --- Baseten: Muse Spark Open (open weights) over the OpenAI-style chat completions API. ---
// Web search grounding is a Meta API feature, so callMetaSearch always stays on Meta.
const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
const BASETEN_MODEL = "meta-models/muse-spark-open-1026";

export function useBaseten(): boolean {
  return process.env.MODEL_PROVIDER === "baseten";
}

interface ChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

async function basetenChat(messages: ChatMessage[], tools?: AgentTool[]): Promise<ChatMessage> {
  const key = process.env.BASETEN_API_KEY;
  if (!key) throw new Error("BASETEN_API_KEY is not set");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  try {
    const res = await fetch(BASETEN_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: BASETEN_MODEL,
        messages,
        max_tokens: 30000,
        temperature: 0,
        ...(tools ? { tools: tools.map((t) => ({ type: "function", function: t })) } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Baseten returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new Error("Baseten response had no message");
    if (!msg.content && !msg.tool_calls?.length) {
      console.error(`[baseten] empty reply: finish_reason=${choice.finish_reason} completion_tokens=${data.usage?.completion_tokens} reasoning_chars=${String(msg.reasoning_content ?? "").length}`);
    }
    return msg;
  } finally {
    clearTimeout(timer);
  }
}

async function basetenText(instructions: string, input: string): Promise<string> {
  const msg = await basetenChat([{ role: "system", content: instructions }, { role: "user", content: input }]);
  if (!msg.content) throw new Error("Baseten response had no text output");
  return msg.content;
}

async function runAgentChat(
  instructions: string,
  task: string,
  tools: AgentTool[],
  run: (name: string, args: Record<string, unknown>) => string,
  maxTurns: number,
): Promise<{ text: string; turns: number }> {
  const messages: ChatMessage[] = [{ role: "system", content: instructions }, { role: "user", content: task }];
  let text = "";
  for (let turn = 1; turn <= maxTurns; turn++) {
    const msg = await basetenChat(messages, tools);
    messages.push({ role: "assistant", content: msg.content ?? "", ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) });
    text = msg.content ?? "";
    if (!msg.tool_calls || msg.tool_calls.length === 0) return { text, turns: turn };
    for (const c of msg.tool_calls) {
      let out: string;
      try {
        out = run(c.function.name, JSON.parse(c.function.arguments || "{}"));
      } catch (err) {
        out = `Error: ${err instanceof Error ? err.message : "tool failed"}`;
      }
      messages.push({ role: "tool", tool_call_id: c.id, content: out.slice(0, 6000) });
    }
  }
  return { text, turns: maxTurns };
}
