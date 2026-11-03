interface Services {
  owner: (token: string) => Promise<string | null>;
  query: (request: Record<string, unknown>) => Promise<unknown>;
}

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
const fail = (status: number, message: string) => respond({ error: message }, status);
const integer = (text: string | null, fallback: number, zero = false) => {
  if (text === null) return fallback;
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= (zero ? 0 : 1) && value <= (zero ? 4_000_000 : 1_000_000_000) ? value : null;
};

async function boundedBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16000) { await reader.cancel(); throw new Error("Review is too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Expected a review object");
  return result as Record<string, unknown>;
}

export function createResearchHandlers(services: Services) {
  async function authorize(request: Request) {
    const header = request.headers.get("authorization") ?? "";
    if (!header.startsWith("Bearer ") || !header.slice(7).trim()) return { error: fail(401, "Sign in to view private research.") };
    const owner = await services.owner(header.slice(7).trim());
    return owner ? { owner } : { error: fail(403, "This page is available only to the app owner.") };
  }
  return {
    GET: async (request: Request) => {
      try {
        const auth = await authorize(request);
        if (auth.error) return auth.error;
        const url = new URL(request.url);
        if (url.searchParams.has("scan")) {
          const scan = integer(url.searchParams.get("scan"), 0);
          const physicalPage = integer(url.searchParams.get("physical_page"), 1);
          if (!scan || !physicalPage || physicalPage > 500 || url.searchParams.has("version")) return fail(400, "Choose a saved scan and a physical page.");
          return respond(await services.query({ action: "scan_preview", scan_id: scan, page: physicalPage }));
        }
        const version = integer(url.searchParams.get("version"), 0);
        const start = integer(url.searchParams.get("start"), 0, true);
        const page = integer(url.searchParams.get("page"), 1);
        const search = url.searchParams.get("search") ?? "";
        if (version === null || start === null || page === null || page > 100000 || search.length > 200) return fail(400, "Choose a valid document, text position or source search.");
        return respond(await services.query(version ? { action: "document", version_id: version, start } : { action: "overview", page, search }));
      } catch {
        console.error("[research] Private research could not be loaded.");
        return fail(503, "Research storage is unavailable. Try again when the worker is connected.");
      }
    },
    POST: async (request: Request) => {
      try {
        const auth = await authorize(request);
        if (auth.error) return auth.error;
        let body: Record<string, unknown>;
        try { body = await boundedBody(request); }
        catch { return fail(400, "Enter a valid review with a short note."); }
        if (body.action === "scan_passage") {
          const region = body.region;
          if (!Number.isSafeInteger(body.scan_id) || Number(body.scan_id) < 1 || !Number.isSafeInteger(body.page) || Number(body.page) < 1 || Number(body.page) > 500 || typeof body.pdf_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(body.pdf_sha256) || typeof body.image_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(body.image_sha256) || typeof body.quote !== "string" || body.quote.trim().length < 40 || body.quote.trim().length > 500 || body.confirmed !== true || !Array.isArray(region) || region.length !== 4 || !region.every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 10000) || !region[2] || !region[3]) return fail(400, "Review the source image, enter its exact passage and region, and confirm the comparison.");
          return respond(await services.query({ action: "scan_passage", scan_id: body.scan_id, page: body.page, pdf_sha256: body.pdf_sha256, image_sha256: body.image_sha256, quote: body.quote.trim(), region, confirmed: true, actor: auth.owner }));
        }
        if (!Number.isSafeInteger(body.report_id) || Number(body.report_id) < 1 || typeof body.finding_id !== "string" || !body.finding_id || body.finding_id.length > 80 || !["reviewed", "dismissed", "follow_up"].includes(String(body.status)) || typeof body.note !== "string" || !body.note.trim() || body.note.length > 2000) return fail(400, "Choose a finding, review status and note.");
        return respond(await services.query({ action: "review", report_id: body.report_id, finding_id: body.finding_id, status: body.status, note: body.note, actor: auth.owner }));
      } catch {
        console.error("[research] Review could not be saved.");
        return fail(503, "Your review could not be saved. The original analysis is unchanged.");
      }
    },
  };
}
