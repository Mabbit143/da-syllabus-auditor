import { NextResponse } from "next/server";
import { cleanKits, FIX_INSTRUCTIONS, type Finding, type FixKit } from "@/lib/fixes";
import { callMeta } from "@/lib/meta";
import { FALLBACK_NOTE } from "@/lib/providers";

export const maxDuration = 300;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function readFindings(body: unknown): Finding[] | null {
  const list = (body as { findings?: unknown })?.findings;
  if (!Array.isArray(list) || list.length === 0 || list.length > 10) return null;
  const out: Finding[] = [];
  for (const f of list) {
    if (!f || typeof f.id !== "string" || typeof f.label !== "string" || typeof f.quote !== "string") return null;
    if (f.quote.length > 800 || (f.quote2 && String(f.quote2).length > 800)) return null;
    out.push({
      id: f.id.slice(0, 80),
      kind: ["flag", "signal", "conflict", "gap"].includes(f.kind) ? f.kind : "signal",
      label: f.label.slice(0, 300),
      quote: f.quote,
      page: Number(f.page) || 0,
      ...(typeof f.quote2 === "string" ? { quote2: f.quote2, page2: Number(f.page2) || 0 } : {}),
    });
  }
  return out;
}

async function fixBatch(findings: Finding[], onFallback: () => void): Promise<FixKit[]> {
  const input = findings
    .map((f) => `FINDING ${f.id} (${f.kind}): ${f.label}\nQuote (page ${f.page}): ${f.quote || "(none: nothing was found)"}${f.quote2 ? `\nConflicting quote (page ${f.page2}): ${f.quote2}` : ""}`)
    .join("\n\n");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callMeta(FIX_INSTRUCTIONS, input, onFallback);
      const a = raw.indexOf("{");
      const b = raw.lastIndexOf("}");
      if (a === -1 || b <= a) throw new Error("Model output contained no JSON object");
      const kits = cleanKits(JSON.parse(raw.slice(a, b + 1)), findings);
      if (kits.length === 0) throw new Error("Model returned no usable fixes"); // an empty result is a failure, not a success
      return kits;
    } catch (err) {
      console.error(`[api/fixes] batch attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return []; // this batch is skipped; the others still count
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "bad_json", "Request was not valid JSON.");
    }
    const findings = readFindings(body);
    if (!findings) return fail(400, "invalid_request", "Between 1 and 10 findings are required.");

    let fellBack = false;
    // Small batches keep each answer short, so a failure costs one batch, not everything.
    const batches: Finding[][] = [];
    for (let i = 0; i < findings.length; i += 4) batches.push(findings.slice(i, i + 4));
    const results = await Promise.all(batches.map((batch) => fixBatch(batch, () => { fellBack = true; })));
    const kits = results.flat();
    if (kits.length === 0) throw new Error("No batch produced usable fixes");
    return NextResponse.json({ kits, ...(fellBack ? { note: FALLBACK_NOTE } : {}) });
  } catch (err) {
    console.error("[api/fixes] failed:", err instanceof Error ? err.message : err);
    return fail(500, "fixes_failed", "The fixes could not be generated. Please try again.");
  }
}
