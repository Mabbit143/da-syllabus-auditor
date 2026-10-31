import type { Page } from "./types";

/** A span of original page text that supports one fact. Offsets index the page's own text. */
export interface LedgerCitation {
  page: number;
  start: number;
  end: number;
  text: string;
}

export type LedgerStatus = "found" | "conflict" | "not_found";

export interface LedgerEntry<T> {
  value: T | null;
  status: LedgerStatus;
  /** Every span the value rests on, in page order. */
  citations: LedgerCitation[];
  /** Set when the status is "conflict": what disagreed, in plain words. */
  explanation?: string;
  /** Set when the status is "conflict": the two spans that disagree, so the report can cite both. */
  conflictPair?: [LedgerCitation, LedgerCitation];
}

/** One row of a grade table: a graded component with the figures actually printed beside it. */
export interface GradeComponentFact {
  name: string;
  points: number | null;
  percent: number | null;
  /** True for a summary row ("Total 920 100%"), which is never a component. */
  isTotal: boolean;
  citation: LedgerCitation;
}

/** One numbered week of a course schedule and the calendar dates printed under it. */
export interface ScheduleWeekFact {
  week: number;
  /** Dates as printed, normalized to "M/D". */
  dates: string[];
  citation: LedgerCitation;
}

export interface EvidenceLedger {
  /** Graded components with a stated percent, excluding total rows. */
  gradeComponents: LedgerEntry<GradeComponentFact[]>;
  /** The subset of components that grade attendance. Lecture and lab stay separate rows. */
  attendance: LedgerEntry<GradeComponentFact[]>;
  /** Numbered weeks mapped to their printed dates. */
  schedule: LedgerEntry<ScheduleWeekFact[]>;
}

/** A page's lines with their offsets inside that page's text. */
function lines(page: Page): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  let start = 0;
  for (const raw of page.text.split("\n")) {
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) out.push({ text: trimmed, start: start + lead, end: start + lead + trimmed.length });
    start += raw.length + 1;
  }
  return out;
}

const cite = (page: Page, line: { text: string; start: number; end: number }): LedgerCitation => ({
  page: page.pageNumber,
  start: line.start,
  end: line.end,
  text: page.text.slice(line.start, line.end),
});

// A grade row is a table row, not a sentence that happens to end in a percent: its columns are
// separated by a real gap (two or more spaces, a tab, or dot leaders) in the extracted text.
const COLUMN_GAP = "(?:[ \\t]{2,}|\\.{3,}|\\t)";
const ROW = new RegExp(`^([^\\d%\\n]{3,60}?)${COLUMN_GAP}(?:(\\d{1,4})${COLUMN_GAP})?(\\d{1,3}(?:\\.\\d+)?)[ \\t]*(?:%|percent\\b)[ \\t]*$`, "i");
const TOTAL = /^total\b|\btotal$|^overall\b|^course grade/i;
// Sentence words. A line that *describes* a threshold or penalty states no component's share of the
// grade, so it must never become a grade fact: that would invent a figure the table never printed.
const PROSE = /\b(if|when|will|must|may|should|than|because|your|you|their|please|note|up to|at least|minimum|maximum|less|more|below|above|require[sd]?|threshold|worth|curved?|passing|earn|receive|miss(ed|es)?|lose|deduct)\b/i;

function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").replace(/[\s.:,-]+$/, "").trim();
}

function gradeRows(pages: Page[]): GradeComponentFact[] {
  const facts: GradeComponentFact[] = [];
  for (const page of pages) {
    for (const line of lines(page)) {
      if (PROSE.test(line.text)) continue;
      const m = ROW.exec(line.text);
      if (!m) continue;
      const name = normalizeName(m[1]);
      if (name.length < 3 || name.split(/\s+/).length > 8) continue;
      const percent = Number(m[3]);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) continue;
      facts.push({
        name,
        points: m[2] === undefined ? null : Number(m[2]),
        percent,
        // A row carrying the whole grade is a summary line, whatever it is called.
        isTotal: TOTAL.test(name) || percent === 100,
        citation: cite(page, line),
      });
    }
  }
  return facts;
}

/** Two rows with the same name but different percents cannot both be true. */
function conflictingPair(facts: GradeComponentFact[]): [GradeComponentFact, GradeComponentFact] | null {
  const seen = new Map<string, GradeComponentFact>();
  for (const f of facts) {
    const key = f.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const prior = seen.get(key);
    if (prior && prior.percent !== f.percent) return [prior, f];
    if (!prior) seen.set(key, f);
  }
  return null;
}

// "Week 4 - Origins" and a bare table column "4   Lecture   10/20" both start a week. A number
// ending in "." or ":" without the word "week" is prose ("Chapter 11: Whose past?"), and a number
// alone on a line is a page footer, so neither starts a week.
const WEEK_WORD_HEADER = /^week\s*(\d{1,2})\b/i;
const BARE_WEEK_HEADER = /^(\d{1,2})(?:[ \t]{2,}(?=\S)|[ \t]+(?=Lecture\b|Lab\b|Week\b|Seminar\b|Unit\b|Module\b|\d{1,2}\/\d{1,2}))/i;
// A line in capitals is a section heading ("IMPORTANT DATES"), which ends the schedule's rows.
const SECTION_HEADING = /^[^a-z\d]*[A-Z][^a-z]{3,}$/;
const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})\b/g;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "May" and "Mar" are ordinary words too, so a named date needs its capital letter.
const WORDED_DATE = new RegExp(`\\b(${MONTHS.map((m) => `${m[0].toUpperCase()}${m.slice(1)}`).join("|")})[a-z]*\\.?\\s+(\\d{1,2})\\b`, "g");
// A share of the grade ("worth 1/3 of the grade") is not a date.
const SHARE_CONTEXT = /\b(worth|out of|fraction|share|of (the|your) (grade|final|total)|of all)\b/i;

function weekHeader(text: string): number | null {
  const m = WEEK_WORD_HEADER.exec(text) ?? BARE_WEEK_HEADER.exec(text);
  if (!m) return null;
  const week = Number(m[1]);
  return Number.isInteger(week) && week >= 1 && week <= 20 ? week : null;
}

/** Dates as the syllabus prints them, numeric or named, normalized to "M/D" for comparison. */
export function datesIn(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(NUMERIC_DATE)) {
    const month = Number(m[1]), day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    // Skip a ratio: read the words either side of this match, not the whole document.
    if (SHARE_CONTEXT.test(text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + m[0].length + 40))) continue;
    found.push(`${month}/${day}`);
  }
  for (const m of text.matchAll(WORDED_DATE)) {
    const day = Number(m[2]);
    if (day >= 1 && day <= 31) found.push(`${MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1}/${day}`);
  }
  return found;
}

function scheduleWeeks(pages: Page[]): ScheduleWeekFact[] {
  const byWeek = new Map<number, ScheduleWeekFact>();
  // A schedule's dates sit on the pages that carry its week headers. Dates elsewhere in the
  // document (drop deadlines, a final-exam notice) belong to no week.
  const schedulePages = new Set(pages.filter((p) => lines(p).some((l) => weekHeader(l.text) !== null)).map((p) => p.pageNumber));
  let current: ScheduleWeekFact | null = null;
  for (const page of pages) {
    if (!schedulePages.has(page.pageNumber)) { current = null; continue; }
    for (const line of lines(page)) {
      const week = weekHeader(line.text);
      if (week !== null) {
        current = byWeek.get(week) ?? { week, dates: [], citation: cite(page, line) };
        byWeek.set(week, current);
      } else if (SECTION_HEADING.test(line.text)) {
        current = null; // a new section: later dates are not this week's
      }
      if (!current) continue;
      for (const date of datesIn(line.text)) if (!current.dates.includes(date)) current.dates.push(date);
    }
  }
  // A date printed under two different weeks tells us nothing about either one.
  const owners = new Map<string, number[]>();
  for (const w of byWeek.values()) for (const d of w.dates) owners.set(d, [...(owners.get(d) ?? []), w.week]);
  for (const w of byWeek.values()) w.dates = w.dates.filter((d) => (owners.get(d) ?? []).length === 1);
  // Keep only an unbroken run of weeks from 1: a real schedule numbers its weeks in order, while a
  // stray number elsewhere in the document does not continue the sequence.
  const run: ScheduleWeekFact[] = [];
  for (const w of [...byWeek.values()].sort((a, b) => a.week - b.week)) if (w.week === run.length + 1) run.push(w);
  return run.length >= 2 ? run : [];
}

/** Reads the facts a syllabus prints plainly. No model, no inference: same text in, same facts out. */
export function buildLedger(pages: Page[]): EvidenceLedger {
  const components = gradeRows(pages).filter((r) => !r.isTotal);
  const attendanceRows = components.filter((r) => /attendance|absence/i.test(r.name));
  const weeks = scheduleWeeks(pages);

  const entry = (rows: GradeComponentFact[]): LedgerEntry<GradeComponentFact[]> => {
    if (!rows.length) return { value: null, status: "not_found", citations: [] };
    const citations = rows.map((r) => r.citation);
    const pair = conflictingPair(rows);
    if (!pair) return { value: rows, status: "found", citations };
    return {
      value: rows,
      status: "conflict",
      citations,
      explanation: `The syllabus states two different percentages for "${pair[0].name}": ${pair[0].percent}% and ${pair[1].percent}%.`,
      conflictPair: [pair[0].citation, pair[1].citation],
    };
  };

  return {
    gradeComponents: entry(components),
    attendance: entry(attendanceRows),
    schedule: weeks.length
      ? { value: weeks, status: "found", citations: weeks.map((w) => w.citation) }
      : { value: null, status: "not_found", citations: [] },
  };
}

export interface AttendanceFact {
  rows: GradeComponentFact[];
  /** The rows' shares added together. Always disclosed as a sum, never as a printed figure. */
  total: number;
  /** The largest single printed share, which is what severity is judged on. */
  largest: number;
}

/** The attendance rows and their shares. Null unless every row states a percent and none conflict. */
export function attendanceFact(ledger: EvidenceLedger): AttendanceFact | null {
  const rows = ledger.attendance.status === "found" ? ledger.attendance.value : null;
  if (!rows?.length || rows.some((r) => r.percent === null)) return null;
  const percents = rows.map((r) => r.percent as number);
  return {
    rows,
    total: Math.round(percents.reduce((a, b) => a + b, 0) * 100) / 100,
    largest: Math.max(...percents),
  };
}

export type WeekSupport = "supported" | "contradicted" | "unsupported" | "no_schedule";

/**
 * Whether a passage actually places an assessment in the claimed week. A passage may say so by
 * naming the week, by printing a date the schedule lists under that week, or by sitting under that
 * week's own header in the document. A date from another week, or another week's header,
 * contradicts the claim. Position in a list is never evidence of a week.
 */
export function weekSupport(ledger: EvidenceLedger, week: number, passage: { page: number; start: number; text: string }): WeekSupport {
  if (!Number.isInteger(week)) return "unsupported";
  if (new RegExp(`\\bweek\\s*0*${week}\\b`, "i").test(passage.text)) return "supported";
  const weeks = ledger.schedule.status === "found" ? ledger.schedule.value : null;
  if (!weeks?.length) return "no_schedule";
  const dates = datesIn(passage.text);
  const claimed = weeks.find((w) => w.week === week);
  if (claimed && dates.some((d) => claimed.dates.includes(d))) return "supported";
  if (weeks.some((w) => w.week !== week && dates.some((d) => w.dates.includes(d)))) return "contradicted";
  // The header this passage sits under: document structure, not list order. Only pages that carry
  // the schedule's own headers are read this way, so prose later in the document is not "under" a week.
  const schedulePages = new Set(weeks.map((w) => w.citation.page));
  const before = schedulePages.has(passage.page)
    ? weeks
        .filter((w) => w.citation.page < passage.page || (w.citation.page === passage.page && w.citation.start <= passage.start))
        .sort((a, b) => (a.citation.page - b.citation.page) || (a.citation.start - b.citation.start))
    : [];
  const enclosing = before[before.length - 1];
  if (enclosing) return enclosing.week === week ? "supported" : "contradicted";
  // Nothing encloses this passage and it names no date this schedule knows.
  return dates.length ? "unsupported" : "no_schedule";
}
