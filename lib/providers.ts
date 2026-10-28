export type AnalysisProvider = "meta" | "baseten";

export function analysisProvider(env: Record<string, string | undefined> = process.env): AnalysisProvider {
  const value = env.MODEL_PROVIDER?.trim() || "meta";
  if (value !== "meta" && value !== "baseten") throw new Error("MODEL_PROVIDER must be meta or baseten.");
  return value;
}

export const FALLBACK_NOTE = "Some steps of this analysis ran on Baseten's Muse Spark Open model because Meta did not answer.";

export function analysisDisclosure(provider: AnalysisProvider, env: Record<string, string | undefined> = process.env): string {
  const dual = provider === "meta" && !!env.BASETEN_API_KEY ? " The comparison with your school's policies is read by both Meta and Baseten, and a verdict is shown only where they agree." : "";
  return provider === "baseten"
    ? "Extracted syllabus text is sent to Baseten, which hosts Meta's Muse Spark Open model. Meta receives public web-research queries when needed."
    : "Extracted syllabus text is sent to Meta for analysis and public web research when needed. If Meta does not answer, the same text goes to Baseten, which hosts Meta's Muse Spark Open model, and the report says so." + dual;
}
