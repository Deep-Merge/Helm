from typing import Literal

from pydantic import BaseModel, Field


class ProjectSyncItem(BaseModel):
    freelancer_project_id: str
    url: str
    title: str
    description: str = ""
    budget_text: str | None = None
    budget_type: Literal["fixed", "hourly", "unknown"] = "unknown"
    budget_min: float | None = None
    budget_max: float | None = None
    client_country: str | None = None
    client_country_flag: str | None = None
    client_location: str | None = None
    client_rating: float | None = None
    client_review_count: int | None = None
    skills: list[str] = Field(default_factory=list)
    clarifications: list[dict] = Field(default_factory=list)
    submitted_bid_amount: float | None = None
    submitted_delivery_days: int | None = None


class ProjectSyncRequest(BaseModel):
    projects: list[ProjectSyncItem]


class GenerateBidRequest(BaseModel):
    project_id: str | None = None
    freelancer_project_id: str | None = None
    url: str | None = None
    title: str
    description: str
    budget_text: str | None = None
    budget_type: Literal["fixed", "hourly", "unknown"] = "unknown"
    skills: list[str] = Field(default_factory=list)
    direction: str | None = None
    model_tier: Literal["auto", "standard", "premium"] = "auto"
    analyze_only: bool = False
    clarifications: list[dict] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    title: str
    description: str
    budget_text: str | None = None
    skills: list[str] = Field(default_factory=list)


class StatusUpdateRequest(BaseModel):
    status: Literal["viewed", "drafted", "submitted", "ignored", "won", "lost"]


class LocalRegisterRequest(BaseModel):
    email: str
    password: str


class LocalLoginRequest(BaseModel):
    email: str
    password: str


class AdminCreateUserRequest(BaseModel):
    email: str
    password: str
    role: Literal["user", "admin"] = "user"


class AdminSetPasswordRequest(BaseModel):
    password: str


class AdminSetEmailRequest(BaseModel):
    email: str


class BidUpdateRequest(BaseModel):
    proposal_text: str | None = None
    bid_amount: float | None = None
    delivery_days: int | None = None
    questions: list[str] | None = None
    status: Literal["draft", "submitted", "archived"] | None = None


class SubmitBidRequest(BaseModel):
    project_id: str | None = None
    bid_id: str | None = None
    freelancer_project_id: str
    url: str
    title: str
    description: str = ""
    budget_text: str | None = None
    budget_type: Literal["fixed", "hourly", "unknown"] = "unknown"
    budget_min: float | None = None
    budget_max: float | None = None
    skills: list[str] = Field(default_factory=list)
    proposal_text: str = ""
    bid_amount: float | None = None
    delivery_days: int | None = None
    questions: list[str] = Field(default_factory=list)
    clarifications: list[dict] = Field(default_factory=list)
    client_country: str | None = None
    client_country_flag: str | None = None
    client_location: str | None = None
    client_rating: float | None = None
    client_review_count: int | None = None
    submitted_bid_amount: float | None = None
    submitted_delivery_days: int | None = None


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    title: str | None = None
    bio: str | None = None
    skills: list[str] | None = None
    proposal_style: str | None = None
    default_direction: str | None = None
    default_model_tier: Literal["auto", "standard", "premium"] | None = None


class WatcherConfigCreate(BaseModel):
    name: str
    search_url: str
    keywords: list[str] = Field(default_factory=list)
    min_budget: float | None = None
    max_budget: float | None = None
    skills: list[str] = Field(default_factory=list)
    poll_interval_sec: int = 60
    is_active: bool = True


class WatcherConfigUpdate(BaseModel):
    name: str | None = None
    search_url: str | None = None
    keywords: list[str] | None = None
    min_budget: float | None = None
    max_budget: float | None = None
    skills: list[str] | None = None
    poll_interval_sec: int | None = None
    is_active: bool | None = None


class TemplateCreate(BaseModel):
    name: str
    content: str
    tags: list[str] = Field(default_factory=list)
    is_winning_example: bool = False


class TemplateUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    is_winning_example: bool | None = None


class SavedFilterCreate(BaseModel):
    name: str
    q: str | None = None
    countries: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    min_budget: float | None = None
    max_budget: float | None = None
    budget_type: Literal["fixed", "hourly", "any"] = "any"
    exclude_submitted: bool = False
    days: int | None = None


class SavedFilterUpdate(BaseModel):
    name: str | None = None
    q: str | None = None
    countries: list[str] | None = None
    skills: list[str] | None = None
    min_budget: float | None = None
    max_budget: float | None = None
    budget_type: Literal["fixed", "hourly", "any"] | None = None
    exclude_submitted: bool | None = None
    days: int | None = None
