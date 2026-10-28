"use client";

import { useState } from "react";
import { POLICY_PAIRS, type PairResult, type PairSide } from "@/lib/policy/pairs-types";

type State = { loading: true } | { error: string } | { result: PairResult };

function Side({ s }: { s: PairSide }) {
  return (
    <div>
      <p className="muted">{s.name} · section {s.page} · <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a></p>
      <blockquote className="quote">{s.quote}</blockquote>
    </div>
  );
}

export default function Policies() {
  const [state, setState] = useState<Record<string, State>>({});

  async function run(id: string) {
    setState((s) => ({ ...s, [id]: { loading: true } }));
    try {
      const res = await fetch("/api/policy-pairs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Request failed.");
      setState((s) => ({ ...s, [id]: { result: data as PairResult } }));
    } catch (err) {
      console.error("[pairs] request failed:", err);
      setState((s) => ({ ...s, [id]: { error: err instanceof Error ? err.message : "Request failed." } }));
    }
  }

  return (
    <main>
      <h1>UO against itself</h1>
      <p className="muted">Pairs of University of Oregon pages on the same topic. Each difference shows both passages, quoted exactly from the saved page, with its link. Wording is from the saved copy of each page; check the live page before relying on it.</p>
      {POLICY_PAIRS.map((p) => {
        const st = state[p.id];
        return (
          <div key={p.id} className="card mixed">
            <h4>{p.label}</h4>
            <button onClick={() => run(p.id)} disabled={!!st && "loading" in st}>{st && "loading" in st ? "Comparing…" : "Compare"}</button>
            {st && "error" in st && <p role="alert">{st.error}</p>}
            {st && "result" in st && (
              <>
                {st.result.note && <p>{st.result.note}</p>}
                {st.result.differences.map((d, i) => (
                  <div key={i}>
                    <p><strong>{d.explanation}</strong> <span className="muted">(summary by the model; the two quotes are the evidence)</span></p>
                    <Side s={d.a} />
                    <Side s={d.b} />
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </main>
  );
}
