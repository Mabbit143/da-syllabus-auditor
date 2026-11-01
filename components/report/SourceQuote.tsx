"use client";

import { useId, useState } from "react";
import { pageLocator } from "@/lib/locator";
import type { Page, Passage } from "@/lib/types";

function sentenceAround(text: string, start: number, end: number): [string, string] {
  const before = text.slice(Math.max(0, start - 200), start);
  const cut = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "), before.lastIndexOf("\n"));
  const after = text.slice(end, end + 200);
  const stop = after.search(/[.!?](\s|$)/);
  return [cut === -1 ? "" : before.slice(cut + 1).trimStart(), stop === -1 ? "" : after.slice(0, stop + 1)];
}

export default function SourceQuote({ passage, pages, evidenceId }: { passage: Passage; pages: Page[]; evidenceId?: string }) {
  const [open, setOpen] = useState(false);
  const autoId = useId();
  const contextId = evidenceId ?? `quote-context-${autoId.replace(/:/g, "")}`;
  const text = pages.find((p) => p.pageNumber === passage.page)?.text ?? "";
  const [lead, trail] = sentenceAround(text, passage.start, passage.end);
  const where = pageLocator(pages, passage.page, { capitalize: true });
  return (
    <blockquote className="quote">
      <p>
        &ldquo;{lead && <span className="muted">{lead} </span>}
        {passage.text}
        {trail && <span className="muted">{trail}</span>}&rdquo;
      </p>
      <span className="where">
        <span className="stamp">Verified</span>
        {where}{" "}
        <button
          type="button"
          className="link noprint"
          aria-expanded={open}
          aria-controls={contextId}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide context" : "See in context"}
        </button>
      </span>
      <div id={contextId} className="context-wrap" hidden={!open}>
        <p className="context-label">Context from {where}</p>
        <pre className="context">
          {text.slice(Math.max(0, passage.start - 300), passage.start)}
          <mark>{text.slice(passage.start, passage.end)}</mark>
          {text.slice(passage.end, passage.end + 300)}
        </pre>
      </div>
    </blockquote>
  );
}

export function MissingPassage() {
  return <p className="muted">We could not display the supporting text.</p>;
}
