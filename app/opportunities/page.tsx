"use client";

import { useEffect, useRef, useState } from "react";
import { useUserId } from "@/components/Nav";
import OppCard, { type OppStatus } from "@/components/OppCard";
import { loadProfile, loadStatuses, saveProfile, saveStatus } from "@/lib/cloud";
import {
  FUNDING_TYPES, REQUIREMENT_FLAGS, type FundingType, type Profile, type RankedOpportunity, type RequirementFlag,
} from "@/lib/opps/types";

const PROFILE_KEY = "da-syllabus-auditor.profile.v1";
const STATUS_KEY = "da-syllabus-auditor.oppstatus.v1";
const COURSES_KEY = "da-syllabus-auditor.courses.v1";

const EMPTY: Profile = { major: "", school: "", location: "", hoursPerWeek: 10, flags: [], termStart: null };
const FLAG_LABEL: Record<RequirementFlag, string> = {
  first_gen: "First-generation", returning: "Returning or adult student", low_income: "Low income", parent: "Student parent",
  undergrad: "Undergraduate", grad: "Graduate student", veteran: "Veteran", disability: "Student with a disability", transfer: "Transfer student",
};
const TYPE_LABEL: Record<FundingType, string> = { scholarship: "Scholarships", grant: "Grants", fellowship: "Fellowships", emergency: "Emergency funding" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be blocked or full; the page still works for this session.
  }
}

// Weeks with 3 or more assessments across the saved syllabus audits.
function crunchWeeksFromAudits(): number[] {
  const courses = read<{ report?: { assessments?: { week: number }[] } }[]>(COURSES_KEY, []);
  const counts = new Map<number, number>();
  for (const c of courses) for (const a of c.report?.assessments ?? []) counts.set(a.week, (counts.get(a.week) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= 3).map(([w]) => w);
}

export default function Opportunities() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [statuses, setStatuses] = useState<Record<string, OppStatus>>({});
  const [results, setResults] = useState<RankedOpportunity[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FundingType | "all" | "saved">("all");

  const userId = useUserId();
  const [savedOpps, setSavedOpps] = useState<Record<string, RankedOpportunity>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Device storage is read after mount so server and first client render match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(read(PROFILE_KEY, EMPTY));
    setStatuses(read(STATUS_KEY, {}));
  }, []);

  // Signed in: load the account's profile and saved listings; if the account is empty, upload this device's.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const remoteProfile = await loadProfile();
      if (remoteProfile) {
        setProfile(remoteProfile);
        write(PROFILE_KEY, remoteProfile);
      } else {
        await saveProfile(read(PROFILE_KEY, EMPTY));
      }
      const remote = await loadStatuses();
      if (remote) {
        const map: Record<string, OppStatus> = {};
        const opps: Record<string, RankedOpportunity> = {};
        for (const r of remote) {
          map[r.url] = r.status;
          opps[r.url] = r.opp;
        }
        setStatuses((prev) => ({ ...prev, ...map }));
        setSavedOpps(opps);
      }
    })();
  }, [userId]);

  function setP(patch: Partial<Profile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    write(PROFILE_KEY, next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveProfile(next), 800);
  }
  function setStatus(opp: RankedOpportunity, s: OppStatus) {
    const next = { ...statuses, [opp.url]: s };
    setStatuses(next);
    write(STATUS_KEY, next);
    setSavedOpps((prev) => ({ ...prev, [opp.url]: opp }));
    void saveStatus({ url: opp.url, status: s, opp });
  }

  async function search() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, crunchWeeks: crunchWeeksFromAudits() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The search failed.");
      setResults(data.opportunities);
      const droppedTotal = Object.values(data.dropped as Record<string, number>).reduce((a, b) => a + b, 0);
      setNote(`Ran ${data.searches} searches. ${data.opportunities.length} verified listings fit your profile; ${droppedTotal} candidates were dropped because their pages did not back up the details or they charged a fee.`);
    } catch (err) {
      console.error("[opportunities] failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const pool = filter === "saved"
    ? Object.values(savedOpps).sort((a, b) => a.rank - b.rank)
    : (results ?? []);
  const visible = pool.filter((o) => {
    const s = statuses[o.url] ?? "new";
    if (filter === "saved") return s === "saved";
    return s !== "rejected" && (filter === "all" || o.type === filter);
  });

  return (
    <main>
      <h1 className="noprint">Find funding</h1>
      <section className="noprint">
        <p>Tell us about you. We search for scholarships, grants, fellowships and emergency funding, then check every listing against its own page. Your profile stays in this browser.</p>
        <div className="form">
          <label>Major<input value={profile.major} onChange={(e) => setP({ major: e.target.value })} /></label>
          <label>School<input value={profile.school} onChange={(e) => setP({ school: e.target.value })} /></label>
          <label>State or city<input value={profile.location} onChange={(e) => setP({ location: e.target.value })} /></label>
          <label>Hours a week you can work<input type="number" min={0} max={80} value={profile.hoursPerWeek} onChange={(e) => setP({ hoursPerWeek: Number(e.target.value) })} /></label>
          <label>Term start date<input type="date" value={profile.termStart ?? ""} onChange={(e) => setP({ termStart: e.target.value || null })} /></label>
        </div>
        <fieldset>
          <legend>Check everything that is true for you</legend>
          {REQUIREMENT_FLAGS.map((f) => (
            <label key={f} className="check">
              <input type="checkbox" checked={profile.flags.includes(f)} onChange={(e) => setP({ flags: e.target.checked ? [...profile.flags, f] : profile.flags.filter((x) => x !== f) })} />
              {FLAG_LABEL[f]}
            </label>
          ))}
        </fieldset>
        <p className="muted">We only show listings you qualify for. Add your term start date and audit your syllabi, and deadlines that land in your crunch weeks sink to the bottom.</p>
        <button type="button" onClick={search} disabled={busy}>{busy ? "Searching…" : "Find funding"}</button>
      </section>

      {busy && <p role="status">Searching and checking pages. This takes about a minute…</p>}
      {error && <p role="alert" className="warn">{error}</p>}
      {note && !busy && <p className="muted">{note}</p>}

      {(results || Object.keys(savedOpps).length > 0) && !busy && (
        <section>
          <div className="chips noprint" role="group" aria-label="Filter by type">
            {(["all", ...FUNDING_TYPES, "saved"] as const).map((t) => (
              <button key={t} type="button" className={filter === t ? "chip on" : "chip"} aria-pressed={filter === t} onClick={() => setFilter(t)}>
                {t === "all" ? "All" : t === "saved" ? "Saved" : TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {visible.length === 0 && <p>Nothing here yet. Try different filters, or add details to your profile.</p>}
          {visible.map((o) => (
            <OppCard key={o.url} opp={o} status={statuses[o.url] ?? "new"} onStatus={(s) => setStatus(o, s)} />
          ))}
        </section>
      )}
    </main>
  );
}
