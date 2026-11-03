import type { ResearchOverview } from "@/lib/research/types";

export default function SourceCoverage({ coverage, open }: {
  coverage: NonNullable<ResearchOverview["coverage"]>;
  open: (version: number, start: number) => void;
}) {
  return <details>
    <summary>Saved source coverage</summary>
    <p>{coverage.note}</p>
    <p>{coverage.total_documents} saved URL(s) · {coverage.archived_snapshots} historical web snapshot(s) · {coverage.headline_only} headline-only record(s) excluded from analysis.</p>
    <table>
      <caption>Saved intake categories and extraction availability</caption>
      <thead><tr><th scope="col">Intake category</th><th scope="col">Saved URLs</th><th scope="col">Text available</th><th scope="col">Headline only</th><th scope="col">Historical</th></tr></thead>
      <tbody>{Object.entries(coverage.categories).sort(([a], [b]) => a.localeCompare(b)).map(([category, counts]) => <tr key={category}>
        <th scope="row">{category.replaceAll("_", " ")}</th><td>{counts.documents}</td><td>{counts.analysis_ready}</td><td>{counts.headline_only}</td><td>{counts.archived}</td>
      </tr>)}</tbody>
    </table>
    {coverage.headline_examples.length > 0 && <><p>Headline-only examples (up to 20); article bodies remain unavailable in these snapshots.</p><ul>{coverage.headline_examples.map((item) => <li key={item.version_id}>
      <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>{" · "}<button onClick={() => open(item.version_id, 0)}>Inspect saved headline</button>
    </li>)}</ul></>}
  </details>;
}
