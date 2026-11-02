// Generates a basic ICS calendar from audited assessments.
// Weeks are mapped to calendar dates using the syllabus term when known,
// otherwise the current date. All times are set to 23:59 local on the
// Monday of that week — students can move them after import.

import type { Assessment } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcsDate(d: Date): string {
  // UTC format: YYYYMMDDTHHMMSSZ
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// Approximate term start Mondays — close enough for a useful import.
// Students can adjust after import; the file notes these are estimates.
function termStartMonday(termId: string | null): Date {
  if (!termId) return mondayOf(new Date());
  const [yearStr, season] = termId.split("-");
  const year = Number(yearStr);
  // Mondays near the season boundaries used in lib/term.ts
  const map: Record<string, string> = {
    winter: `${year}-01-05`,
    spring: `${year}-03-30`,
    summer: `${year}-06-22`,
    fall: `${year}-09-21`,
  };
  const iso = map[season] ?? `${year}-09-21`;
  const d = new Date(`${iso}T00:00:00`);
  return mondayOf(d);
}

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function dateForWeek(week: number, termId: string | null): Date {
  const start = termStartMonday(termId);
  const d = new Date(start);
  d.setDate(start.getDate() + (week - 1) * 7);
  // Due at end of that Monday's week — set to 23:59 UTC of that Sunday
  // Simpler: Monday 23:59 — visible and editable
  d.setHours(23, 59, 0, 0);
  return d;
}

export function buildIcs(args: {
  fileName: string;
  termId?: string | null;
  assessments: Assessment[];
  courseLabel?: string;
}): string {
  const now = toIcsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DA Syllabus Auditor//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(args.courseLabel ?? args.fileName)} due dates`,
  ];

  const termNote = args.termId
    ? `Dates are estimates from ${args.termId} week numbers in the syllabus. Verify against the syllabus.`
    : "Dates are estimates from week numbers in the syllabus. Verify against the syllabus.";

  for (const a of args.assessments) {
    if (a.week < 1 || a.week > 15) continue;
    const dt = dateForWeek(a.week, args.termId ?? null);
    const dtStr = toIcsDate(dt);
    const title = `${a.what}${a.percent ? ` (${a.percent}%)` : ""}`;
    const uid = `${a.passageId}@da-syllabus-auditor`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStr}`,
      `DTEND:${dtStr}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(`${termNote}\\nSource: ${args.fileName} — week ${a.week}${a.percent ? `, ${a.percent}%` : ""}`)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
