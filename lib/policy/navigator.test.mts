import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import "../../test-support/register-typescript.mjs";

const OEOA = "Office of Equal Opportunity and Access";
const QUOTE = "The Office of Equal Opportunity and Access will make every effort to consider requests received outside this deadline.";

async function loaded() {
  // @ts-expect-error Native Node TS entry point.
  const { SITUATIONS } = await import("./navigator-types.ts");
  // @ts-expect-error Native Node TS entry point.
  const { findOffices } = await import("./navigator.ts");
  // @ts-expect-error Native Node TS entry point.
  const { loadDoc } = await import("./pairs.ts");
  return { SITUATIONS, findOffices, loadDoc };
}

/** A model answer naming one office, with the page where the quote really sits. */
async function answer(office: string, quote: string, contact = "") {
  const { loadDoc } = await loaded();
  const doc = await loadDoc({ file: "045-provost-religious-observance-accommodations-policy.md", name: "x" });
  const page = doc.pages.find((p: { text: string }) => p.text.includes(QUOTE))?.pageNumber ?? 1;
  return async () => JSON.stringify({ offices: [{ office, contact, doc: 1, page, quote }] });
}

test("every situation points at saved UO pages with a uoregon.edu source", async () => {
  const { SITUATIONS, loadDoc } = await loaded();
  assert.ok(SITUATIONS.length >= 5);
  for (const s of SITUATIONS) {
    for (const f of s.files) {
      await readFile(path.join(process.cwd(), "data/uo-policies", f.file), "utf8"); // exists
      const doc = await loadDoc(f); // throws if the source is missing or outside uoregon.edu
      assert.match(new URL(doc.url).hostname, /(^|\.)uoregon\.edu$/);
    }
  }
});

test("an office is shown only with an exact quote that contains its name", async () => {
  const { findOffices } = await loaded();
  const ok = await findOffices("religious", await answer(OEOA, QUOTE));
  assert.equal(ok.offices.length, 1);
  assert.equal(ok.offices[0].office, OEOA);

  const fabricated = await findOffices("religious", await answer(OEOA, "The Office of Equal Opportunity and Access will personally resolve every request within one day."));
  assert.equal(fabricated.offices.length, 0);
  assert.match(fabricated.note, /No saved UO page names an office/);

  const wrongName = await findOffices("religious", await answer("Office of the Registrar", QUOTE));
  assert.equal(wrongName.offices.length, 0); // the quote is real but does not name that office
});

test("a contact that is not in the quote is dropped", async () => {
  const { findOffices } = await loaded();
  const r = await findOffices("religious", await answer(OEOA, QUOTE, "541-555-0000"));
  assert.equal(r.offices[0].contact, "");
});

test("an office only one of two models named is marked, not hidden", async () => {
  const { findOffices } = await loaded();
  const none = async () => JSON.stringify({ offices: [] });
  const r = await findOffices("religious", await answer(OEOA, QUOTE), none);
  assert.equal(r.offices.length, 1);
  assert.equal(r.offices[0].confirmedByBoth, false);
  const both = await findOffices("religious", await answer(OEOA, QUOTE), await answer(OEOA, QUOTE));
  assert.equal(both.offices[0].confirmedByBoth, true);
});

test("if the second model fails the first stands alone, and an unknown id is rejected", async () => {
  const { findOffices } = await loaded();
  const r = await findOffices("religious", await answer(OEOA, QUOTE), async () => { throw new Error("down"); });
  assert.equal(r.offices.length, 1);
  await assert.rejects(findOffices("../../etc/passwd", await answer(OEOA, QUOTE)), /Unknown situation/);
});

test("the same office under an acronym or a longer spelling is one office", async () => {
  const { findOffices } = await loaded();
  const doc = "045-provost-religious-observance-accommodations-policy.md";
  // @ts-expect-error Native Node TS entry point.
  const { loadDoc } = await import("./pairs.ts");
  const d = await loadDoc({ file: doc, name: "x" });
  const page = d.pages.find((p: { text: string }) => p.text.includes(QUOTE))?.pageNumber ?? 1;
  const twice = async () => JSON.stringify({ offices: [
    { office: "Office of Equal Opportunity and Access", contact: "", doc: 1, page, quote: QUOTE },
    { office: "Equal Opportunity and Access", contact: "", doc: 1, page, quote: QUOTE },
  ] });
  assert.equal((await findOffices("religious", twice)).offices.length, 1);
  const { SITUATIONS } = await loaded();
  assert.ok(SITUATIONS.length >= 5);
});
