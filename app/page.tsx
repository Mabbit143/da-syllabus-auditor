import AuditorHome from "@/components/AuditorHome";
import { analysisProvider, analysisDisclosure } from "@/lib/providers";

export default function Home() {
  return <AuditorHome disclosure={analysisDisclosure(analysisProvider())} />;
}
