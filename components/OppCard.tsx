"use client";

import type { RankedOpportunity } from "@/lib/opps/types";

export type OppStatus = "new" | "saved" | "rejected";

const TYPE_LABEL = { scholarship: "Scholarship", grant: "Grant", fellowship: "Fellowship", emergency: "Emergency funding" } as const;

function Quote({ label, text }: { label: string; text: string }) {
  return (
    <blockquote className="quote">
      <p>&ldquo;{text}&rdquo;</p>
      <span className="where"><span className="stamp">Verified</span>{label}</span>
    </blockquote>
  );
}

export default function OppCard({ opp, status, onStatus }: {
  opp: RankedOpportunity;
  status: OppStatus;
  onStatus: (s: OppStatus) => void;
}) {
  return (
    <div className={`card ${opp.crunchWeek !== null ? "sev-medium" : "strong"}`}>
      <h4>
        #{opp.rank} {opp.title} <span className="grade">{TYPE_LABEL[opp.type]}</span>
      </h4>
      <p className="muted">
        {opp.sponsor} · {opp.amount !== null ? `$${opp.amount.toLocaleString("en-US")}` : "amount not stated"} ·{" "}
        {opp.deadline ? `due ${opp.deadline}` : "no fixed deadline stated"}
      </p>
      <ul className="why">{opp.why.map((w) => <li key={w}>{w}</li>)}</ul>
      <Quote label="Eligibility, from the page" text={opp.quotes.eligibility} />
      {opp.quotes.amount && <Quote label="Amount, from the page" text={opp.quotes.amount} />}
      {opp.quotes.deadline && <Quote label="Deadline, from the page" text={opp.quotes.deadline} />}
      <p className="actions noprint">
        <a href={opp.url} target="_blank" rel="noopener noreferrer">Open the official page</a>{" "}
        <button type="button" onClick={() => onStatus(status === "saved" ? "new" : "saved")}>
          {status === "saved" ? "Saved ✓ (undo)" : "Save"}
        </button>{" "}
        <button type="button" className="link" onClick={() => onStatus("rejected")}>Not for me</button>
      </p>
    </div>
  );
}
