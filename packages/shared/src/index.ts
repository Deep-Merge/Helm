export type ProjectStatus =
  | "new"
  | "viewed"
  | "drafted"
  | "submitted"
  | "ignored"
  | "won"
  | "lost";

export type BidStatus = "draft" | "submitted" | "archived";

export type ModelTier = "auto" | "standard" | "premium";

export interface Project {
  id: string;
  freelancer_project_id: string;
  url: string;
  title: string;
  description: string;
  budget_text: string | null;
  budget_min: number | null;
  budget_max: number | null;
  skills: string[];
  status: ProjectStatus;
  risk_score: number | null;
  first_seen_at: string;
  last_seen_at: string;
  submitted_at: string | null;
}

export interface Bid {
  id: string;
  project_id: string;
  version: number;
  status: BidStatus;
  proposal_text: string;
  bid_amount: number | null;
  delivery_days: number | null;
  questions: string[];
  direction: string | null;
  model_used: string | null;
  model_tier: ModelTier;
  created_at: string;
}

export interface GenerateBidRequest {
  project_id?: string;
  title: string;
  description: string;
  budget_text?: string;
  skills?: string[];
  direction?: string;
  model_tier?: ModelTier;
}

export interface GenerateBidResponse {
  bid_id: string;
  project_id: string;
  proposal: string;
  bid_amount: number | null;
  delivery_days: number | null;
  questions: string[];
  risk_score: number | null;
  risk_notes: string | null;
  model_used: string;
}

export interface AnalyticsOverview {
  projects_discovered: number;
  projects_viewed: number;
  proposals_generated: number;
  submitted: number;
  submission_rate: number;
  win_rate: number;
}
