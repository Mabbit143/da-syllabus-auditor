"use client";

import type { RankedOpportunity, Profile } from "./opps/types";
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
}

export async function loadAudits(): Promise<StoredAudit[] | null> {
  try {
    if (!(await uid())) return null;
    const { data, error } = await supabase()!.from("audits").select("id,report,pages").order("created_at");
    if (error) throw error;
    return (data ?? []) as StoredAudit[];
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
