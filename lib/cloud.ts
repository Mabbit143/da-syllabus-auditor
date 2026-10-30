"use client";

import type { RankedOpportunity, Profile } from "./opps/types";
import type { PolicyComparison, PolicyTopic, SchoolPolicy } from "./policy/types";
import type { AuditReport, Page } from "./types";
import { supabase } from "./supabase";

// Row-level security limits every query to the signed-in user's own rows.

async function uid(): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data.session?.user.id ?? null;
}

function log(what: string, err: unknown) {
  console.error(`[cloud] ${what} failed:`, err instanceof Error ? err.message : err);
}

export async function loadProfile(): Promise<Profile | null> {
  try {
    const id = await uid();
    if (!id) return null;
    const { data, error } = await supabase()!.from("profiles").select("data").eq("user_id", id).maybeSingle();
    if (error) throw error;
    return (data?.data as Profile) ?? null;
  } catch (err) {
    log("load profile", err);
    return null;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  try {
    const id = await uid();
    if (!id) return;
    const { error } = await supabase()!.from("profiles").upsert({ user_id: id, data: profile, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (err) {
    log("save profile", err);
  }
}

export interface StoredStatus {
  url: string;
  status: "new" | "saved" | "rejected";
  opp: RankedOpportunity;
}

export async function loadStatuses(): Promise<StoredStatus[] | null> {
  try {
    if (!(await uid())) return null;
    const { data, error } = await supabase()!.from("opp_status").select("url,status,opp");
    if (error) throw error;
    return (data ?? []) as StoredStatus[];
  } catch (err) {
    log("load statuses", err);
    return null;
  }
}

export async function saveStatus(s: StoredStatus): Promise<void> {
  try {
    const id = await uid();
    if (!id) return;
    const { error } = await supabase()!.from("opp_status").upsert({ user_id: id, url: s.url, status: s.status, opp: s.opp, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (err) {
    log("save status", err);
  }
}

export interface StoredAudit {
  id: string;
  report: AuditReport;
  pages: Page[];
  /** ISO timestamp used to bucket this audit into a term (lib/term.ts). Missing on audits saved before this field existed. */
  createdAt?: string;
}

export async function loadAudits(): Promise<StoredAudit[] | null> {
  try {
    if (!(await uid())) return null;
    const { data, error } = await supabase()!.from("audits").select("id,report,pages,created_at").order("created_at");
    if (error) throw error;
    return (data ?? []).map((row: { id: string; report: unknown; pages: unknown; created_at: string }) => ({
      id: row.id, report: row.report as AuditReport, pages: row.pages as Page[], createdAt: row.created_at,
    }));
  } catch (err) {
    log("load audits", err);
    return null;
  }
}

export async function saveAudit(a: StoredAudit): Promise<void> {
  try {
    const id = await uid();
    if (!id) return;
    const { error } = await supabase()!.from("audits").upsert({ id: a.id, user_id: id, file_name: a.report.fileName, report: a.report, pages: a.pages });
    if (error) throw error;
  } catch (err) {
    log("save audit", err);
  }
}

export async function deleteAudit(auditId: string): Promise<void> {
  try {
    if (!(await uid())) return;
    const { error } = await supabase()!.from("audits").delete().eq("id", auditId);
    if (error) throw error;
  } catch (err) {
    log("delete audit", err);
  }
}

// Policy check: the school's rules are cached per school, and differences from them go to a private master list.

export const schoolKey = (school: string) => school.toLowerCase().replace(/\s+/g, " ").trim();

export async function loadSchoolPolicies(school: string): Promise<SchoolPolicy[]> {
  try {
    if (!(await uid())) return [];
    const { data, error } = await supabase()!.from("school_policies").select("policies").eq("school_key", schoolKey(school)).maybeSingle();
    if (error) throw error;
    return (data?.policies as SchoolPolicy[]) ?? [];
  } catch (err) {
    log("load school policies", err);
    return [];
  }
}

export async function saveSchoolPolicies(school: string, policies: SchoolPolicy[]): Promise<void> {
  try {
    if (!(await uid())) return;
    const { error } = await supabase()!.from("school_policies").upsert({ school_key: schoolKey(school), policies, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (err) {
    log("save school policies", err);
  }
}

/**
 * Adds the differences to the master list, through a server route that re-verifies every quote
 * with a service-role key (db/003-policy-gaps-server-only.sql). The browser is never trusted to
 * insert directly — see the "Known weakness" note in db/002-policy-gaps.sql for why.
 */
export async function recordGaps(school: string, pages: Page[], items: PolicyComparison[]): Promise<void> {
  try {
    const db = supabase();
    if (!db) return;
    const { data } = await db.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/record-gaps", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ school: schoolKey(school), pages, items }),
    });
    if (!res.ok) throw new Error(`record-gaps responded ${res.status}`);
  } catch (err) {
    log("record gaps", err);
  }
}

export interface GapGroup {
  school: string;
  topic: PolicyTopic;
  kind: "conflicts" | "adds_requirement" | "silent";
  syllabi: number;
  flagged: boolean;
  entries: { instructor: string | null; syllabusQuote: string | null; syllabusPage: number | null; schoolQuote: string; schoolUrl: string; at: string }[];
}

/** Owner only: the database refuses anyone who is not listed in app_owners. */
export async function loadGapReport(): Promise<GapGroup[] | null> {
  try {
    if (!(await uid())) return null;
    const { data, error } = await supabase()!.rpc("gap_report", { threshold: 5 });
    if (error) throw error;
    return data as GapGroup[];
  } catch (err) {
    log("load gap report", err);
    return null;
  }
}
