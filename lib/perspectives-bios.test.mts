import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

// @ts-expect-error Native Node TS entry point.
const { runAudit } = await import("./audit.ts");
// @ts-expect-error Native Node TS entry point.
const { BIO_INSTRUCTIONS, CONFIRM_INSTRUCTIONS } = await import("./sources.ts");
// @ts-expect-error Native Node TS entry point.
const { INSTRUCTIONS, READINGS_INSTRUCTIONS } = await import("./audit.ts");

const PAGE = `WEEK 1
- Smith, J., Village Life (2001).
- Hall, K., The Outsider Gaze (2002).
- Nadir, P., Views from Afar (2004).
- Fox, L., Field Notes (2003).
- Reed, M., Distant Hills (2005).`;

const pages = [{ pageNumber: 1, text: PAGE }];

interface MockBio {
  author: string;
  found: boolean;
  url: string;
  quote: string;
  relation: "insider_stated" | "outsider_stated" | "unclear";
  supported: boolean;
}

const bio = (author: string, relation: MockBio["relation"], supported = true): MockBio => ({
  author,
  found: relation !== "unclear" ? true : true,
  url: `https://profiles.example.edu/${author.toLowerCase()}`,
  quote: `${author} writes about the valley community, describing their own background.`,
  relation,
  supported,
});

/** Drives one audit with mocked model and web search so author bios can be steered offline. */
async function run(readings: unknown[], bios: MockBio[], pagesOverride = pages) {
  const prompts: string[] = [];
  const queried: string[] = [];
  const model = async (instructions: string, input: string) => {
    prompts.push(instructions);
    if (instructions === READINGS_INSTRUCTIONS) return JSON.stringify({ readings });
    if (instructions === CONFIRM_INSTRUCTIONS) {
      const hit = bios.find((b) => input.includes(b.quote));
      return JSON.stringify({ supported: hit ? hit.supported : false });
    }
    if (instructions === INSTRUCTIONS) return JSON.stringify({});
    if (instructions.startsWith("You find evidence in a university syllabus")) return JSON.stringify({ signals: [] });
    return JSON.stringify({});
  };
  const search = async (instructions: string, input: string) => {
    assert.equal(instructions, BIO_INSTRUCTIONS, "search is only used for author bios");
    const author = /Author: (.*)/m.exec(input)?.[1]?.trim() ?? "";
    queried.push(author);
    const b = bios.find((x) => x.author === author);
    if (!b || !b.found) return { text: JSON.stringify({ bios: [] }), results: [] };
    return {
      text: JSON.stringify({ bios: [{ url: b.url, quote: b.quote, relation: b.relation }] }),
      // The snippet carries the quote verbatim, so verifyBio passes without a real fetch.
      results: [{ url: b.url, snippet: `Author profile. ${b.quote} Further details.` }],
    };
  };
  const report = await runAudit({ requestId: "t", fileName: "t.pdf", pageCount: pagesOverride.length, pages: pagesOverride }, model, search);
  return { report, prompts, queried };
}

const perspectives = (report: { dimensions: { dimension: string; status: string; positive: number; negative: number; hits: unknown[] }[] }) => {
  const d = report.dimensions.find((x) => x.dimension === "perspectives");
  assert.ok(d, "no perspectives dimension in the report");
  return d;
};

const reading = (author: string, quote: string) => ({
  author,
  title: `a reading by ${author}`,
  topic: "the valley community",
  page: 1,
  quote,
});

const citation = (author: string, rest: string) => reading(author, `${author}, ${rest}.`);

test("a verified outsider bio grades as a P7 negative with the author's own evidence", async () => {
  const { report, prompts } = await run(
    [citation("Hall", "K., The Outsider Gaze (2002)")],
    [bio("Hall", "outsider_stated")],
  );
  const d = perspectives(report);
  assert.equal(d.positive, 0);
  assert.equal(d.negative, 1);
  assert.equal(d.status, "mixed", "one P7 alone is mixed, not weak");
  const hit = d.hits[0] as { code: string; polarity: number; evidence?: { author: string; url: string; quote: string } };
  assert.equal(hit.code, "P7");
  assert.equal(hit.polarity, -1);
  assert.equal(hit.evidence?.author, "Hall");
  assert.equal(hit.evidence?.url, "https://profiles.example.edu/hall");
  // P7 is code-decided only: no prompt may offer it to the model.
  assert.ok(prompts.every((p) => !p.includes("P7")), "P7 must never be offered in a model prompt");
});

test("the same run grades an insider P6 positive and an outsider P7 negative apart", async () => {
  const { report } = await run(
    [citation("Smith", "J., Village Life (2001)"), citation("Hall", "K., The Outsider Gaze (2002)")],
    [bio("Smith", "insider_stated"), bio("Hall", "outsider_stated")],
  );
  const d = perspectives(report);
  const codes = (d.hits as { code: string; polarity: number }[]).map((h) => [h.code, h.polarity]);
  assert.deepEqual(codes.sort(), [["P6", 1], ["P7", -1]]);
  assert.equal(d.positive, 1);
  assert.equal(d.negative, 1);
  assert.equal(d.status, "mixed");
});

test("two outsider bios knock perspectives off strong to weak, citing their own bios", async () => {
  const { report } = await run(
    [citation("Hall", "K., The Outsider Gaze (2002)"), citation("Nadir", "P., Views from Afar (2004)")],
    [bio("Hall", "outsider_stated"), bio("Nadir", "outsider_stated")],
  );
  const d = perspectives(report);
  assert.equal(d.status, "weak");
  assert.equal(d.negative, 2);
  assert.equal(d.positive, 0);
  assert.equal((d.hits as { code: string }[]).every((h) => h.code === "P7"), true);
});

test("an unconfirmed claim or an unclear relation never becomes a hit", async () => {
  const { report } = await run(
    [citation("Fox", "L., Field Notes (2003)"), citation("Reed", "M., Distant Hills (2005)")],
    [bio("Fox", "outsider_stated", false), bio("Reed", "unclear")],
  );
  const d = perspectives(report);
  assert.equal(d.hits.length, 0);
  assert.equal(d.status, "not_found");
  assert.equal(d.negative, 0);
});

test("every sampled author is recorded, including those whose bio counted for nothing", async () => {
  // No bios mocked at all: each lookup still gets a recorded outcome ("not found"), so the
  // report can show what the check did instead of silently omitting the reading list.
  const { report } = await run(
    [citation("Smith", "J., Village Life (2001)"), citation("Hall", "K., The Outsider Gaze (2002)")],
    [],
  );
  const d = perspectives(report);
  assert.equal(d.hits.length, 0);
  const sa = report.sourceAuthors;
  assert.ok(sa, "the report must disclose the author check");
  assert.equal(sa.verified, 2);
  assert.equal(sa.sampled, 2);
  assert.deepEqual(sa.authors.map((a) => a.author).sort(), ["Hall", "Smith"]);
  assert.ok(sa.authors.every((a) => a.outcome === "not_found"));
});

test("more verified authors than the cap are sampled at random, not by reading order", async () => {
  const authors = Array.from({ length: 20 }, (_, i) => `Author${i}`);
  const lines = authors.map((a, i) => `${a}, Outside Views (${2000 + i}).`);
  const readings = authors.map((a, i) => reading(a, lines[i]));
  const bigPage = [{ pageNumber: 1, text: lines.map((l) => `- ${l}`).join("\n") }];
  const { queried } = await run(readings, [], bigPage);
  // Exactly the spec's cap of 12 author lookups, each a distinct qualifying author.
  assert.equal(queried.length, 12);
  assert.equal(new Set(queried).size, 12);
  assert.ok(queried.every((a) => authors.includes(a)), "sampled authors must come from the syllabus's own list");
});

test("a list within the cap looks up every verified author", async () => {
  const { queried } = await run(
    [citation("Smith", "J., Village Life (2001)"), citation("Hall", "K., The Outsider Gaze (2002)")],
    [bio("Smith", "insider_stated"), bio("Hall", "outsider_stated")],
  );
  assert.equal(queried.length, 2);
  assert.equal(new Set(queried).size, 2);
  assert.deepEqual(queried.slice().sort(), ["Hall", "Smith"]);
});

test("three verified pieces are all recorded with insider precedence over affiliation", async () => {
  // Nigerian explicit insider + Ohio affiliation outsider on the same author: insider wins,
  // all pieces stay visible in sourceAuthors for the lay-out.
  const readings = [reading("Ada", "Yoruba Ritual (2019)")];
  const bigPage = [{ pageNumber: 1, text: `- Ada, Yoruba Ritual (2019).` }];
  const pieces = [
    { url: "https://en.wikipedia.org/wiki/Ada", quote: "Ada is a Nigerian scholar of Yoruba ritual.", relation: "insider_stated", supported: true },
    { url: "https://profiles.example.edu/ada", quote: "Ada is based at Ohio State University in the United States.", relation: "outsider_stated", supported: true },
    { url: "https://publisher.example.edu/ada", quote: "Ada writes on Yoruba ritual, background unclear in this profile.", relation: "unclear", supported: true },
  ];
  const prompts: string[] = [];
  const model = async (instructions: string, input: string) => {
    prompts.push(instructions);
    if (instructions === READINGS_INSTRUCTIONS) return JSON.stringify({ readings });
    if (instructions === CONFIRM_INSTRUCTIONS) {
      const hit = pieces.find((b) => input.includes(b.quote));
      return JSON.stringify({ supported: hit ? hit.supported : false });
    }
    if (instructions === INSTRUCTIONS) return JSON.stringify({});
    if (instructions.startsWith("You find evidence in a university syllabus")) return JSON.stringify({ signals: [] });
    return JSON.stringify({});
  };
  const search = async () => ({
    text: JSON.stringify({ bios: pieces.map(({ url, quote, relation }) => ({ url, quote, relation })) }),
    results: pieces.map(({ url, quote }) => ({ url, snippet: `Profile. ${quote} More.` })),
  });
  const report = await runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: bigPage }, model, search);
  const d = perspectives(report);
  assert.equal(d.positive, 1);
  assert.equal(d.negative, 0);
  const hit = d.hits[0] as { code: string; evidence?: { url: string } };
  assert.equal(hit.code, "P6");
  assert.equal(hit.evidence?.url, "https://en.wikipedia.org/wiki/Ada");
  const sa = report.sourceAuthors;
  assert.ok(sa);
  assert.equal(sa.authors[0].outcome, "insider_stated");
  assert.equal(sa.authors[0].pieces?.length, 3);
});

test("a named based-at place outside the covered community counts as outsider", async () => {
  const readings = [reading("Mayra", "Amazonian Ritual Play (2020)")];
  const bigPage = [{ pageNumber: 1, text: `- Mayra, Amazonian Ritual Play (2020).` }];
  const quote = "Mayra is Professor of Game Studies at Tampere University, Finland.";
  const prompts: string[] = [];
  const model = async (instructions: string) => {
    prompts.push(instructions);
    if (instructions === READINGS_INSTRUCTIONS) return JSON.stringify({ readings });
    if (instructions === CONFIRM_INSTRUCTIONS) return JSON.stringify({ supported: true });
    if (instructions === INSTRUCTIONS) return JSON.stringify({});
    if (instructions.startsWith("You find evidence in a university syllabus")) return JSON.stringify({ signals: [] });
    return JSON.stringify({});
  };
  const search = async () => ({
    text: JSON.stringify({ bios: [{ url: "https://profiles.example.edu/mayra", quote, relation: "outsider_stated" }] }),
    results: [{ url: "https://profiles.example.edu/mayra", snippet: `Bio. ${quote} End.` }],
  });
  const report = await runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: bigPage }, model, search);
  const d = perspectives(report);
  assert.equal(d.negative, 1);
  assert.equal((d.hits[0] as { code: string }).code, "P7");
});

test("a bare employer name with no place never counts", async () => {
  const readings = [reading("Holland", "Southern Cooking (2018)")];
  const bigPage = [{ pageNumber: 1, text: `- Holland, Southern Cooking (2018).` }];
  const quote = "Holland is editorial director for Southern Living Magazine, specializing in cooking.";
  const model = async (instructions: string) => {
    if (instructions === READINGS_INSTRUCTIONS) return JSON.stringify({ readings });
    if (instructions === CONFIRM_INSTRUCTIONS) return JSON.stringify({ supported: false });
    if (instructions === INSTRUCTIONS) return JSON.stringify({});
    if (instructions.startsWith("You find evidence in a university syllabus")) return JSON.stringify({ signals: [] });
    return JSON.stringify({});
  };
  const search = async () => ({
    text: JSON.stringify({ bios: [{ url: "https://profiles.example.edu/holland", quote, relation: "outsider_stated" }] }),
    results: [{ url: "https://profiles.example.edu/holland", snippet: `Bio. ${quote} End.` }],
  });
  const report = await runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: bigPage }, model, search);
  const d = perspectives(report);
  assert.equal(d.hits.length, 0);
  assert.equal(report.sourceAuthors?.authors[0].outcome, "no_stated_relation");
});
