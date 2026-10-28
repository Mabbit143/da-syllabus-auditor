export type AnalysisProvider = "meta" | "baseten";

export function analysisProvider(env: Record<string, string | undefined> = process.env): AnalysisProvider {
  const value = env.MODEL_PROVIDER?.trim() || "meta";
  if (value !== "meta" && value !== "baseten") throw new Error("MODEL_PROVIDER must be meta or baseten.");
  return value;
}

export function analysisDisclosure(provider: AnalysisProvider): string {
  return provider === "baseten"
    ? "Extracted syllabus text is sent to Baseten, which hosts Meta's Muse Spark Open model. Meta receives public web-research queries when needed."
    : "Extracted syllabus text is sent to Meta for analysis and public web research when needed.";
}
