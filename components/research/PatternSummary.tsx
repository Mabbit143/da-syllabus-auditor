import type { ResearchOverview } from "@/lib/research/types";

export default function PatternSummary({ patterns, open }: {
  patterns: NonNullable<ResearchOverview["patterns"]>;
  open: (version: number, start: number) => void;
}) {
  return <details>
    <summary>Evidence groups and possible recurring mechanisms</summary>
    <p>{patterns.limitations}</p>
    {patterns.mechanism_candidates.length === 0 && <p>No repeated mechanism labels across separate evidence groups in these reports.</p>}
    {patterns.mechanism_candidates.map((candidate) => <p key={candidate.id}>
      <strong>{candidate.mechanism}</strong>: {candidate.group_ids.length} evidence groups to compare. Distinct incidents and independent origins remain unverified.
    </p>)}
    {patterns.evidence_groups.map((group, index) => <details key={group.id}>
      <summary>Evidence group {index + 1}: {group.members.length} related lead(s)</summary>
      {group.members.map((member) => <div key={`${member.report_id}:${member.finding_id}`}>
        <p>Report {member.report_id}, lead {member.finding_id}: {member.claim}</p>
        <p>{member.status} · {member.mechanism}{member.owner_status ? ` · owner: ${member.owner_status}` : ""}</p>
        {member.actions.map((evidence, position) => <blockquote key={position}>
          <p>{evidence.quote}</p>
          <a href={evidence.url} target="_blank" rel="noopener noreferrer">Source</a>{" · "}
          <button onClick={() => open(evidence.version_id, Math.max(0, evidence.start - 300))}>Read saved context</button>
        </blockquote>)}
        <p>Use the lead below to inspect the Skeptic review, chronology and counterevidence or record an owner review.</p>
      </div>)}
    </details>)}
  </details>;
}
