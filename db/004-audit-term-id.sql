-- Migration 004 (2026-11-02). Run once in the Supabase SQL editor; safe to run again.
-- Commit 0f43c24 made the audit save include the syllabus term, but this column was never
-- added: every save since then failed with PGRST204 ("Could not find the 'term_id' column
-- of 'audits'"), silently, and the audit existed only on the device until it was replaced
-- on the next sign-in. New audits stopped saving on the production deployment.
alter table public.audits add column if not exists term_id text;
