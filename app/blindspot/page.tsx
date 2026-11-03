"use client";

import { useUserId } from "@/components/Nav";
import ResearchWorkspace from "@/components/research/ResearchWorkspace";

export default function BlindspotPage() {
  const userId = useUserId();
  return <main>
    <h1>Blindspot Engine</h1>
    <p className="muted">Private institutional research: public documents, policy comparisons and investigation records.</p>
    {userId === undefined ? <p role="status">Checking sign-in…</p> : !userId ? <p>Sign in to view private research.</p> : <ResearchWorkspace key={userId} />}
  </main>;
}
