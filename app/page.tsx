import AuditorHome from "@/components/AuditorHome";
import { analysisProvider, analysisDisclosure } from "@/lib/providers";
import { loadAllEvidence } from "@/lib/policy/evidence";

// Reads data/uo-policies/reviewed-ocr at request time (see lib/policy/evidence.ts); not statically prerendered.
export const instant = false;

export default async function Home() {
  const evidence = (await loadAllEvidence()).filter((e) => e.topic.id === "dept_uo_anthropology");
  return <AuditorHome disclosure={analysisDisclosure(analysisProvider())} departmentEvidence={evidence} />;
}
