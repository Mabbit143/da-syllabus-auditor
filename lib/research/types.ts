export interface ResearchEvidence {
  version_id: number; url: string; content_hash: string; quote: string;
  start: number; end: number; page: number | null; role: "policy" | "action" | "context";
  source_locations?: ResearchLocation[];
}
export interface ResearchLocation {
  label: string; start: number; end: number; hidden?: boolean;
  cells?: { cell: string; cached: boolean; formula: string | null; formula_truncated?: boolean }[];
  omitted_cells?: number;
}
export interface ResearchFinding {
  id: string; claim: string; topic: string; mechanism: string; status: string;
  evidence: ResearchEvidence[]; questions: string[]; temporal_scope: string;
  temporal_status: string; publisher_groups: number; distinct_documents: number;
  skeptic: { decision: string; reason: string; counterevidence_search: string; alternative_explanations: string[]; temporal_scope: string; counterevidence: ResearchEvidence[] };
}
export interface ResearchReport {
  id: number; completed_at: number;
  report: { findings: ResearchFinding[]; observations: ResearchFinding[]; rejected_count: number; retrieval?: { method: string; candidate_documents: number; matching_related_documents: number; omitted_related_documents: number; identical_content_collapsed: number; limits: string }; coverage: { version_id: number; reviewed_characters: number; total_characters: number }[]; model_calls?: { provider: string; fallback: boolean; cached?: boolean }[] };
}
export interface ResearchReview { id: number; report_id: number; finding_id: string; status: string; note: string; actor: string; created_at: number }
export interface ResearchQuality { state: string; analysis_ready: boolean; note: string }
export interface ResearchDocument { id: number; url: string; title: string; category: string; method: string; archived_snapshot: boolean; original_fetched_date?: string; published_at?: string; first_seen: number; last_seen: number; quality?: ResearchQuality }
export interface ResearchOverview {
  coverage?: { total_documents: number; archived_snapshots: number; headline_only: number; categories: Record<string, { documents: number; analysis_ready: number; headline_only: number; archived: number }>; headline_examples: { version_id: number; url: string; title: string }[]; note: string };
  scans?: { total_sources: number; limit: number; sources: { id: number; url: string; pdf_sha256: string; page_count: number; needs_review_pages: number[]; approved_passages: number }[] };
  synthesis?: ResearchSynthesis | null;
  patterns?: {
    evidence_groups: { id: string; status: string; members: { report_id: number; finding_id: string; claim: string; topic: string; mechanism: string; status: string; owner_status: string | null; actions: ResearchEvidence[] }[] }[];
    mechanism_candidates: { id: string; mechanism: string; group_ids: string[]; status: string }[];
    limitations: string;
  };
  status: { documents: number; versions: number; analysis_reports: number; latest_analysis_at: number | null; jobs: { kind: string; state: string; count: number }[]; failures: { id: number; kind: string; last_error: string; attempts: number }[]; monitor?: ResearchMonitor; discovery?: { registered_sources: number; queries: { id: number; day: string; query: string; state: string; error: string | null; result_count: number; result_urls: string[] }[] } };
  documents: ResearchDocument[]; page: number; total_documents: number;
  reports: ResearchReport[]; reviews: ResearchReview[]; storage: string;
  history_limits: { reports: number; reviews: number };
}
export interface ScanPreview {
  scan_id: number; url: string; pdf_sha256: string; page: number; page_count: number;
  image_sha256: string; image_data_url: string; width: number; height: number; method: string;
  receipts: { id: string; page: number; quote: string; actor: string; reviewed_at: number }[];
}
interface SynthesisReview {
  decision: string; reason: string; distinctness: string; temporal_scope: string;
  alternative_explanations: string[]; counterevidence_ids: string[];
}
export interface ResearchSynthesis {
  id: number; completed_at: number; input_current: boolean;
  report: {
    incidents: { id: string; summary: string; basis: string; status: string; mechanism_code: string; lead_ids: string[]; evidence_ids: string[]; temporal_scope: string; distinctness: string; skeptic: SynthesisReview }[];
    patterns: { id: string; claim: string; basis: string; kind: string; mechanism_code: string; status: string; incident_ids: string[]; policy_evidence_ids: string[]; temporal_scope: string; questions: string[]; origin_status: string; publication_eligible: boolean; skeptic: SynthesisReview }[];
    evidence: (ResearchEvidence & { id: string })[];
    leads: { id: string; report_id: number; finding_id: string; claim: string }[];
    coverage: { recent_reports: number; omitted_leads: number; invalid_evidence_leads: number; note: string };
    rejected_count: number; limitations: string;
    model_calls?: { provider: string; fallback: boolean; cached?: boolean }[];
  };
}
export interface ResearchMonitor {
  schedule: { next_due: number; interval: number; runner: string; lease_until: number | null } | null;
  runs: { id: number; started_at: number; finished_at: number | null; runner: string; state: string; error: string | null; collection: { collected?: number; failed?: number; review_pending?: number } | null; analysis: { completed?: number; pattern_completed?: number; failed?: number; budget_deferred?: number; daily_limit?: number } | null }[];
  model_usage: { day: string; calls: number }[];
}
export interface ResearchSource {
  quality?: ResearchQuality;
  id: number; url: string; content_hash: string; metadata: { title?: string; original_fetched_date?: string; published_at?: string; coverage?: string };
  text: string; start: number; total_characters: number;
  physical_pages: { page: number; start: number; end: number }[];
  source_locations?: { items: ResearchLocation[]; omitted_locations: number; note: string };
  history: { id: number; content_hash: string; first_seen: number; last_seen: number }[];
}
