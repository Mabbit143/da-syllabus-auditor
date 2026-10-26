const BASE_URL = "https://api.meta.ai/v1";
const MODEL = "muse-spark-1.3"; // Standard mode only: never a -contributor ID.

export interface SearchResult {
  url: string;
  snippet: string;
}

export async function callMeta(instructions: string, input: string): Promise<string> {
  return (await request(instructions, input, false)).text;
}

/** Search-grounded call. Returns the model text plus the raw results it retrieved. */
export async function callMetaSearch(instructions: string, input: string) {
  return request(instructions, input, true);
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
