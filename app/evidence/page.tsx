import { loadAllEvidence } from "@/lib/policy/evidence";

// Reads data/uo-policies/reviewed-ocr at request time; the admitted corpus changes
// independently of a deploy, so this route is intentionally not statically prerendered.
export const instant = false;

export default async function Evidence() {
  const records = await loadAllEvidence();
  const byTopic = new Map<string, typeof records>();
  for (const r of records) {
    const list = byTopic.get(r.topic.id) ?? [];
    list.push(r);
    byTopic.set(r.topic.id, list);
  }
  return (
    <main>
      <h1>Institutional evidence</h1>
      <p className="muted">
        Verified passages from the University of Oregon&rsquo;s own public documents, admitted only after a human
        checked the exact words against the source page image. This is a standing accountability record, independent
        of any individual student&rsquo;s syllabus audit.
      </p>
      {records.length === 0 && <p>Nothing admitted yet.</p>}
      {[...byTopic.entries()].map(([topicId, items]) => (
        <div key={topicId} className="card mixed">
          <h4>{items[0].topic.label}</h4>
          {items[0].topic.description && <p className="muted">{items[0].topic.description}</p>}
          {items.map((r, i) => (
            <blockquote key={i} className="quote">
              <p>&ldquo;{r.quote}&rdquo;</p>
              <span className="where">
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">Source, page {r.page}</a>
                {" · reviewed "}{new Date(r.reviewedAt).toLocaleDateString()}
              </span>
            </blockquote>
          ))}
        </div>
      ))}
    </main>
  );
}
