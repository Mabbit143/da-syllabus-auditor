export const maxDuration = 120;

const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 1_500_000;

const fail = (status: number, message: string) => Response.json({ error: { message } }, { status });

/** Forwards page images of a scanned PDF to the Modal OCR service and returns plain text. Nothing is stored or logged. */
export async function POST(request: Request): Promise<Response> {
  try {
    const url = process.env.MODAL_OCR_URL;
    const token = process.env.OCR_TOKEN;
    if (!url || !token) return fail(503, "Reading scanned files is not available right now.");

    const body: unknown = await request.json().catch(() => null);
    const images = body && typeof body === "object" ? (body as { images?: unknown }).images : undefined;
    if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES ||
        !images.every((i) => typeof i === "string" && i.length > 0 && i.length <= MAX_IMAGE_CHARS)) {
      return fail(400, "Send 1 to 4 page images.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100_000);
    try {
      const res = await fetch(`${url}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`OCR service returned HTTP ${res.status}`);
      const data: unknown = await res.json();
      const pages = data && typeof data === "object" ? (data as { pages?: unknown }).pages : undefined;
      if (!Array.isArray(pages) || pages.length !== images.length || !pages.every((p) => typeof p === "string")) {
        throw new Error("OCR service response was invalid");
      }
      return Response.json({ pages });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error("[ocr] failed:", err instanceof Error ? err.message : err);
    return fail(502, "The scanned pages could not be read. Please try again.");
  }
}
