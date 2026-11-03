export interface ResearchEvidence {
  version_id: number; url: string; content_hash: string; quote: string;
  start: number; end: number; page: number | null; role: "policy" | "action" | "context";
}
export interface ResearchFinding {
  id: string; claim: string; topic: string; mechanism: string; status: string;
  evidence: ResearchEvidence[]; questions: string[]; temporal_scope: string;
  temporal_status: string; publisher_groups: number; distinct_documents: number;
  skeptic: { decision: string; reason: string; counterevidence_search: string; alternative_explanations: string[]; temporal_scope: string; counterevidence: ResearchEvidence[] };
}
export interface ResearchReport {
  id: number; completed_at: number;
  report: { findings: ResearchFinding[]; observations: ResearchFinding[]; rejected_count: number; coverage: { version_id: number; reviewed_characters: number; total_characters: number }[]; model_calls?: { provider: string; fallback: boolean; cached?: boolean }[] };
}
export interface ResearchReview { id: number; report_id: number; finding_id: string; status: string; note: string; actor: string; created_at: number }
export interface ResearchDocument { id: number; url: string; title: string; category: string; method: string; archived_snapshot: boolean; original_fetched_date?: string; published_at?: string; first_seen: number; last_seen: number }
export interface ResearchOverview {
  status: { documents: number; versions: number; analysis_reports: number; latest_analysis_at: number | null; jobs: { kind: string; state: string; count: number }[]; failures: { id: number; kind: string; last_error: string; attempts: number }[]; monitor?: ResearchMonitor };
  documents: ResearchDocument[]; page: number; total_documents: number;
  reports: ResearchReport[]; reviews: ResearchReview[]; storage: string;
  history_limits: { reports: number; reviews: number };
}
export interface ResearchMonitor {
  schedule: { next_due: number; interval: number; runner: string; lease_until: number | null } | null;
  runs: { id: number; started_at: number; finished_at: number | null; runner: string; state: string; error: string | null; collection: { collected?: number; failed?: number } | null; analysis: { completed?: number; failed?: number; budget_deferred?: number; daily_limit?: number } | null }[];
  model_usage: { day: string; calls: number }[];
}
export interface ResearchSource {
  id: number; url: string; content_hash: string; metadata: { title?: string; original_fetched_date?: string; published_at?: string; coverage?: string };
  text: string; start: number; total_characters: number;
  physical_pages: { page: number; start: number; end: number }[];
  history: { id: number; content_hash: string; first_seen: number; last_seen: number }[];
}
