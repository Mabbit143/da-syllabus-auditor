import type { Metadata } from "next";
import { Anton, Roboto, Roboto_Condensed, Roboto_Mono, Special_Elite } from "next/font/google";
import "./globals.css";

const anton = Anton({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const condensed = Roboto_Condensed({ variable: "--font-label", subsets: ["latin"] });
const roboto = Roboto({ variable: "--font-body", subsets: ["latin"], weight: ["400", "700"] });
const mono = Roboto_Mono({ variable: "--font-meta", subsets: ["latin"] });
const typed = Special_Elite({ variable: "--font-typed", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "DA Syllabus Auditor",
  description: "Audit a syllabus for bias, transparency and policy risk, with verified quotes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${condensed.variable} ${roboto.variable} ${mono.variable} ${typed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
