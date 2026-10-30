import { NextResponse } from "next/server";
import { representativeFindings, cleanPacket, PACKET_INSTRUCTIONS, type Packet } from "@/lib/departments-packet";
import type { Finding } from "@/lib/fixes";
import type { Course } from "@/components/TermView";
import { callMeta } from "@/lib/meta";
import { FALLBACK_NOTE } from "@/lib/providers";

export const maxDuration = 300;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type EvidenceQuote = { quote: string; sourceUrl: string; page: number };

function readEvidence(body: unknown): EvidenceQuote | null {
  const e = (body as { evidence?: unknown })?.evidence;
  if (!e || typeof e !== "object") return null;
  const { quote, sourceUrl, page } = e as Record<string, unknown>;
  if (typeof quote !== "string" || typeof sourceUrl !== "string" || typeof page !== "number") return null;
  return { quote: quote.slice(0, 800), sourceUrl, page };
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "bad_json", "Request was not valid JSON.");
    }
    const courses = (body as { courses?: unknown })?.courses;
    if (!Array.isArray(courses) || courses.length === 0 || courses.length > 20) {
      return fail(400, "invalid_request", "Between 1 and 20 courses are required.");
    }
    const evidence = readEvidence(body);
    const findings = representativeFindings(courses as Course[]);
    if (findings.length === 0) {
      return fail(400, "no_findings", "No verified findings to draft a letter from yet.");
    }

    const input = findings
      .map((f: Finding & { course: string }) => `COURSE ${f.course} — ${f.kind}: ${f.label}\nQuote (page ${f.page}): ${f.quote}`)
      .join("\n\n") + (evidence ? `\n\nDEPARTMENT'S OWN PUBLISHED QUOTE (page ${evidence.page}): ${evidence.quote}` : "");

    let fellBack = false;
    let packet: Packet | null = null;
    for (let attempt = 1; attempt <= 3 && !packet; attempt++) {
      try {
        const raw = await callMeta(PACKET_INSTRUCTIONS, input, () => { fellBack = true; });
        const a = raw.indexOf("{");
        const b = raw.lastIndexOf("}");
        if (a === -1 || b <= a) throw new Error("Model output contained no JSON object");
        packet = cleanPacket(JSON.parse(raw.slice(a, b + 1)), findings, evidence);
        if (!packet) throw new Error("Letter quoted something not in the verified findings");
      } catch (err) {
        console.error(`[api/departments/packet] attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
      }
    }
    if (!packet) return fail(502, "packet_failed", "Could not draft a letter grounded only in verified quotes. Please try again.");
    return NextResponse.json({ packet, ...(fellBack ? { note: FALLBACK_NOTE } : {}) });
  } catch (err) {
    console.error("[api/departments/packet] failed:", err instanceof Error ? err.message : err);
    return fail(500, "packet_failed", "Something went wrong.");
  }
}
