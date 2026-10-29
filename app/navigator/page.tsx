"use client";

import { useState } from "react";
import { SITUATIONS, type NavigatorResult } from "@/lib/policy/navigator-types";

type State = { loading: true } | { error: string } | { result: NavigatorResult };

export default function Navigator() {
  const [state, setState] = useState<Record<string, State>>({});

  async function run(id: string) {
    setState((s) => ({ ...s, [id]: { loading: true } }));
    try {
      const res = await fetch("/api/navigator", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Request failed.");
      setState((s) => ({ ...s, [id]: { result: data as NavigatorResult } }));
    } catch (err) {
      console.error("[navigator] request failed:", err);
      setState((s) => ({ ...s, [id]: { error: err instanceof Error ? err.message : "Request failed." } }));
    }
  }

  return (
    <main>
      <h1>Who do I go to?</h1>
      <p className="muted">Pick what is happening. You will see the office the University of Oregon&rsquo;s own pages name, the exact words that say so, and a message you can send. Wording is from a saved copy of each page; check the live page before relying on it. This is not legal or personal advice.</p>
      {SITUATIONS.map((s) => {
        const st = state[s.id];
        const loading = !!st && "loading" in st;
        return (
          <div key={s.id} className="card mixed">
            <h4>{s.label}</h4>
            <button onClick={() => run(s.id)} disabled={loading}>{loading ? "Looking it up…" : "Show me who to go to"}</button>
            {st && "error" in st && <p role="alert" className="warn">{st.error}</p>}
            {st && "result" in st && (
              <>
                {st.result.note && <p>{st.result.note}</p>}
                {st.result.offices.map((o) => (
                  <div key={o.office}>
                    <p><strong>{o.office}</strong>{o.contact && <> · {o.contact}</>}</p>
                    {!o.confirmedByBoth && <p className="muted">Only one of two checks named this office. Read the quote to decide.</p>}
                    <blockquote className="quote"><p>&ldquo;{o.quote}&rdquo;</p><span className="where">{o.source}, section {o.page} · <a href={o.url} target="_blank" rel="noreferrer">official page</a></span></blockquote>
                  </div>
                ))}
                <p className="signal">A message you could send</p>
                <p className="draft">{st.result.message}</p>
              </>
            )}
          </div>
        );
      })}
    </main>
  );
}
