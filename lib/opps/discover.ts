import type { SearchResult } from "../meta";
import { isPublicHttp, pageText, squash } from "../sources";
import {
  FUNDING_TYPES, REQUIREMENT_FLAGS,
  type Candidate, type FundingType, type Opportunity, type Profile, type RequirementFlag,
} from "./types";

type Search = (instructions: string, input: string) => Promise<{ text: string; results: SearchResult[] }>;

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const FEE_PATTERN = /application fee|processing fee|fee to apply|membership (is )?required|requires? (a )?(paid )?membership|must (be|become) a (paid )?member|join (now )?to apply/i;

export const DISCOVER_INSTRUCTIONS = `You find real funding opportunities for a student. Use web search. Never invent an opportunity.
Return ONLY one valid JSON object: {"candidates":[{"type":"scholarship","title":"","sponsor":"","amount":2000,"deadline":"2026-12-01","url":"https://...","requires":["first_gen"],"majors":[],"feeOrMembership":false,"quotes":{"amount":"exact text from the page","deadline":"exact text from the page","eligibility":"exact text from the page"}}]}
Rules:
- "type" is one of: ${FUNDING_TYPES.join(", ")}.
- "url" must be the opportunity's own page, from your search results. "sponsor" must be named on the page.
- Each quote must be copied exactly from that page. "amount" is a number in US dollars or null. "deadline" is YYYY-MM-DD or null (null for rolling).
- "requires" may only use: ${REQUIREMENT_FLAGS.join(", ")}. Use [] if open to all. "majors" lists required majors, else [].
- Set "feeOrMembership" true if applying costs money or needs a paid membership.
- Return at most 5 candidates. Return {"candidates":[]} if you find none.`;

export function buildQueries(p: Profile): string[] {
  const who = [
    p.flags.includes("returning") ? "returning adult students" : "",
    p.flags.includes("first_gen") ? "first-generation students" : "",
    p.flags.includes("parent") ? "student parents" : "",
    p.flags.includes("low_income") ? "low-income students" : "",
  ].filter(Boolean);
  const group = who.length ? who.join(" or ") : "undergraduate students";
  const major = p.major ? ` ${p.major}` : "";
  return [
    `scholarships for ${group}${major} open now`,
    `emergency grants for students ${p.school || ""} ${p.location || ""}`.replace(/\s+/g, " ").trim(),
    `grants for ${group} ${p.location || ""}`.replace(/\s+/g, " ").trim(),
    `fellowships for${major || " undergraduate"} students ${group}`,
    `${p.school || p.location || "state"} university foundation scholarships ${group}`,
  ];
}

function parse(text: string): Candidate[] {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a === -1 || b <= a) return [];
  const o = JSON.parse(text.slice(a, b + 1));
  return Array.isArray(o.candidates) ? o.candidates : [];
}

async function fetchPage(url: string): Promise<string | null> {
  if (!isPublicHttp(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "DASyllabusAuditor/0.1" } });
    if (!res.ok) return null;
    return pageText((await res.text()).slice(0, 1_500_000));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function dateInQuote(iso: string, quote: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const q = quote.toLowerCase();
  const month = MONTHS[Number(m[2]) - 1];
  return (q.includes(month) || q.includes(month.slice(0, 3))) && new RegExp(`\\b0?${Number(m[3])}\\b`).test(q);
}

/** Checks a candidate against the real page text. Returns a verified Opportunity or a reason it was dropped. */
const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();

export function verifyCandidate(c: Candidate, text: string, searched: Set<string>): Opportunity | string {
  // An invented URL fails below: the page is fetched and every quote must appear on it.
  if (!c.title || !c.sponsor || !squash(text).toLowerCase().includes(String(c.sponsor).toLowerCase().slice(0, 40))) return "sponsor not named on page";
  if (c.feeOrMembership || FEE_PATTERN.test(text)) return "fee or membership required";
  const has = (q?: string) => !!q && squash(q).length >= 12 && squash(text).includes(squash(q));
  if (!has(c.quotes?.eligibility)) return "eligibility quote not on page";
  let amount: number | null = null;
  if (c.amount !== null && c.amount !== undefined) {
    const digits = String(Math.round(Number(c.amount)));
    const formatted = Number(digits).toLocaleString("en-US");
    if (!has(c.quotes.amount) || !(c.quotes.amount!.includes(formatted) || c.quotes.amount!.includes(digits))) return "amount not supported by quote";
    amount = Number(digits);
  }
  let deadline: string | null = null;
  if (c.deadline) {
    if (!has(c.quotes.deadline) || !dateInQuote(c.deadline, c.quotes.deadline!)) return "deadline not supported by quote";
    deadline = c.deadline;
  }
  const type = FUNDING_TYPES.includes(c.type as FundingType) ? (c.type as FundingType) : null;
  if (!type) return "unknown type";
  const requires = (c.requires ?? []).filter((r): r is RequirementFlag => (REQUIREMENT_FLAGS as readonly string[]).includes(r));
  return {
    type, title: String(c.title).slice(0, 160), sponsor: String(c.sponsor).slice(0, 120), amount, deadline, url: c.url,
    requires, majors: (c.majors ?? []).map(String).slice(0, 5),
    quotes: { amount: c.quotes.amount, deadline: c.quotes.deadline, eligibility: c.quotes.eligibility! },
  };
}

export async function discoverFunding(profile: Profile, search: Search): Promise<{ found: Opportunity[]; dropped: Record<string, number>; queries: number }> {
  const queries = buildQueries(profile);
  const settled = await Promise.allSettled(
    queries.map(async (q) => {
      for (let attempt = 1; ; attempt++) {
        const r = await search(DISCOVER_INSTRUCTIONS, `Student profile: major ${profile.major || "any"}, school ${profile.school || "any"}, location ${profile.location || "any"}.\nSearch for: ${q}`);
        try {
          return { candidates: parse(r.text), results: r.results };
        } catch (err) {
          console.error(`[opps] bad JSON (attempt ${attempt}):`, err instanceof Error ? err.message : err);
          if (attempt >= 2) throw err;
        }
      }
    }),
  );
  const dropped: Record<string, number> = {};
  const drop = (why: string) => (dropped[why] = (dropped[why] ?? 0) + 1);
  const pending: { c: Candidate; searched: Set<string> }[] = [];
  for (const s of settled) {
    if (s.status === "rejected") {
      console.error("[opps] search failed:", s.reason instanceof Error ? s.reason.message : s.reason);
      continue;
    }
    const searched = new Set(s.value.results.map((r) => r.url));
    for (const c of s.value.candidates) pending.push({ c, searched });
  }
  const byUrl = new Map<string, string | null>();
  await Promise.all([...new Set(pending.map((p) => p.c.url))].map(async (u) => byUrl.set(u, await fetchPage(u))));

  const found: Opportunity[] = [];
  const seen = new Set<string>();
  for (const { c, searched } of pending) {
    const text = byUrl.get(c.url);
    if (!text) { drop("page could not be fetched"); continue; }
    if (seen.has(c.url)) continue;
    const v = verifyCandidate(c, text, searched);
    if (typeof v === "string") { drop(v); continue; }
    seen.add(c.url);
    found.push(v);
    console.log(`[opps] verified: ${v.title} | ${v.amount} | ${v.deadline} | requires=${v.requires.join(",")} | majors=${v.majors.join(",")}`);
  }
  console.log(`[opps] ${queries.length} searches, ${pending.length} candidates, ${found.length} verified, dropped:`, JSON.stringify(dropped));
  return { found, dropped, queries: queries.length };
}
