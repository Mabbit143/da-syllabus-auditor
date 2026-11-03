"use client";

import type { ResearchSource } from "@/lib/research/types";

export default function SourceViewer({ source, open }: { source: ResearchSource; open: (version: number, start?: number) => void }) {
  return <section aria-label="Saved document" className="card mixed">
    <h2>{source.metadata.title || "Saved document"}</h2>
    <p><a href={source.url} target="_blank" rel="noopener noreferrer">Open original source</a></p>
    <p className="muted">Saved version {source.id}. {source.metadata.original_fetched_date ? `Original snapshot: ${source.metadata.original_fetched_date}. ` : ""}{source.metadata.coverage}</p>
    <label>Document version <select value={source.id} onChange={(event) => open(Number(event.target.value))}>
      {source.history.map((version) => <option key={version.id} value={version.id}>Version {version.id} · observed {new Date(version.first_seen * 1000).toLocaleDateString()}</option>)}
    </select></label>
    {source.physical_pages.length > 0 && <p>Physical PDF pages in this passage: {source.physical_pages.map((page) => page.page).join(", ")}</p>}
    {source.source_locations && source.source_locations.items.length > 0 && <details>
      <summary>Word and spreadsheet source locations</summary>
      <p>{source.source_locations.note} {source.source_locations.omitted_locations} additional location(s) omitted.</p>
      <ul>{source.source_locations.items.map((location, index) => <li key={index}>
        {location.label}{location.hidden ? " · hidden sheet or row in the source" : ""}
        {location.cells && <p>Cells: {location.cells.map((cell) => `${cell.cell}${cell.cached ? " (cached formula result; not recalculated)" : ""}`).join(", ")}{location.omitted_cells ? ` · ${location.omitted_cells} cell locator(s) omitted` : ""}</p>}
      </li>)}</ul>
    </details>}
    <pre className="context" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{source.text}</pre>
    <p className="muted">Showing characters {source.start + 1}–{Math.min(source.start + source.text.length, source.total_characters)} of {source.total_characters}.</p>
    <button disabled={source.start === 0} onClick={() => open(source.id, Math.max(0, source.start - 10000))}>Earlier passage</button>{" "}
    <button disabled={source.start + source.text.length >= source.total_characters} onClick={() => open(source.id, source.start + 10000)}>Next passage</button>
  </section>;
}
