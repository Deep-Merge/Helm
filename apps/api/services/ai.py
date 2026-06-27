import json
import re
from typing import Any

from openai import (
    APIConnectionError,
    AuthenticationError,
    OpenAI,
    RateLimitError,
)

from config import settings
from prompts import DEFAULT_PROFILE, SYSTEM_PROMPT

STANDARD_MODEL = "gpt-4o-mini"
PREMIUM_MODEL = "gpt-4o"

# US senior software engineer effective daily rates for bid estimates (AI-assisted delivery).
US_SENIOR_MIN_DAILY_USD = 400
US_SENIOR_TARGET_DAILY_USD = 550


class AIServiceError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _translate_openai_error(exc: Exception) -> AIServiceError:
    text = str(exc).lower()
    if isinstance(exc, AuthenticationError) or "invalid_api_key" in text:
        return AIServiceError(
            "Invalid OpenAI API key. Check OPENAI_API_KEY in apps/api/.env and restart the API.",
            502,
        )
    if isinstance(exc, APIConnectionError):
        return AIServiceError("Could not reach OpenAI. Check your internet connection.", 502)
    if "insufficient_quota" in text or "exceeded your current quota" in text:
        return AIServiceError(
            "OpenAI account has no billing quota. Add a payment method at "
            "https://platform.openai.com/account/billing",
            402,
        )
    if isinstance(exc, RateLimitError) or "rate_limit" in text:
        return AIServiceError("OpenAI rate limit — wait a minute and try again.", 429)
    return AIServiceError(f"OpenAI request failed: {exc}", 502)


def _normalize_questions_from_payload(data: dict[str, Any]) -> list[str]:
    for key in ("questions", "strategic_questions", "client_questions"):
        raw = data.get(key)
        if raw is None:
            continue
        if isinstance(raw, str):
            lines = [line.strip().lstrip("-–•").strip() for line in raw.split("\n") if line.strip()]
            if lines:
                return lines[:2]
        if isinstance(raw, list):
            items = [str(q).strip().lstrip("-–•").strip() for q in raw if str(q).strip()]
            if items:
                return items[:2]
    return []


def _fallback_questions(title: str) -> list[str]:
    topic = title.strip() or "this project"
    return [
        f"What would a successful first delivery look like for {topic}?",
        "Are there integrations, compliance rules, or workflow constraints we should confirm before build starts?",
    ]


def _normalize_feasibility(data: dict[str, Any]) -> str:
    raw = data.get("feasibility") or data.get("feasibility_status")
    if isinstance(raw, str):
        key = raw.strip().lower().replace("-", "_").replace(" ", "_")
        if key in {"full", "fully_feasible", "feasible", "yes", "true"}:
            return "full"
        if key in {"partial", "partially_feasible", "maybe", "limited"}:
            return "partial"
        if key in {"not_feasible", "not", "no", "infeasible", "false"}:
            return "not_feasible"

    score = data.get("risk_score")
    if isinstance(score, (int, float)):
        if score <= 25:
            return "full"
        if score <= 55:
            return "partial"
        return "not_feasible"

    notes = str(data.get("risk_notes") or "").lower()
    if any(word in notes for word in ("not feasible", "infeasible", "cannot deliver", "can't deliver")):
        return "not_feasible"
    if any(word in notes for word in ("partially", "some risk", "major unknown", "unclear scope")):
        return "partial"
    if notes:
        return "full"
    return "partial"


def _normalize_bid_numbers(data: dict[str, Any]) -> None:
    amount = data.get("bid_amount")
    if amount is not None:
        try:
            data["bid_amount"] = max(50, int(round(float(amount))))
        except (TypeError, ValueError):
            data["bid_amount"] = None

    days = data.get("delivery_days")
    if days is not None:
        try:
            data["delivery_days"] = max(1, int(round(float(days))))
        except (TypeError, ValueError):
            data["delivery_days"] = None

    score = data.get("risk_score")
    if score is not None:
        try:
            data["risk_score"] = max(0, min(100, int(round(float(score)))))
        except (TypeError, ValueError):
            data["risk_score"] = None


def _estimate_timeline_cap(title: str, description: str) -> int:
    text = f"{title}\n{description}".lower()
    complexity = 0
    length = len(description or "")

    if length > 2500:
        complexity += 1
    if length > 5000:
        complexity += 1

    heavy = (
        "enterprise", "multi-tenant", "microservice", "machine learning",
        "blockchain", "legacy migration", "sap ", "oracle ", "healthcare hipaa",
        "real-time", "video stream", "marketplace", "payment gateway",
    )
    medium = (
        "mobile app", "android", "ios", "react native", "flutter",
        "dashboard", "admin panel", "crm", "saas", "api integration",
    )

    for kw in heavy:
        if kw in text:
            complexity += 2
    for kw in medium:
        if kw in text:
            complexity += 1

    if complexity >= 4:
        return 30
    if complexity >= 2:
        return 21
    return 14


def _align_budget_and_timeline(data: dict[str, Any], title: str, description: str) -> None:
    amount = data.get("bid_amount")
    days = data.get("delivery_days")
    if not isinstance(days, int):
        return

    cap = _estimate_timeline_cap(title, description)
    if days > cap:
        days = cap
        data["delivery_days"] = days

    if not isinstance(amount, int):
        return

    implied = amount / days if days > 0 else 0

    if implied < US_SENIOR_MIN_DAILY_USD:
        data["bid_amount"] = max(amount, int(round(days * US_SENIOR_TARGET_DAILY_USD)))


def _finalize_bid_payload(data: dict[str, Any], title: str, description: str = "") -> dict[str, Any]:
    proposal = (data.get("proposal") or "").strip()
    if len(proposal) > 1200:
        data["proposal"] = proposal[:1197].rstrip() + "..."

    questions = _normalize_questions_from_payload(data)
    if len(questions) < 2:
        for fallback in _fallback_questions(title):
            if len(questions) >= 2:
                break
            if fallback not in questions:
                questions.append(fallback)
    data["questions"] = questions[:2]

    _normalize_bid_numbers(data)
    _align_budget_and_timeline(data, title, description)
    data["feasibility"] = _normalize_feasibility(data)
    return data


def _chat_completion(client: OpenAI, **kwargs: Any):
    try:
        return client.chat.completions.create(**kwargs)
    except Exception as exc:
        raise _translate_openai_error(exc) from exc


def _parse_budget(budget_text: str | None) -> float | None:
    if not budget_text:
        return None
    numbers = re.findall(r"[\d,]+(?:\.\d+)?", budget_text.replace(",", ""))
    if not numbers:
        return None
    values = [float(n) for n in numbers]
    return max(values)


def resolve_model(tier: str, budget_text: str | None) -> str:
    if tier == "premium":
        return PREMIUM_MODEL
    if tier == "standard":
        return STANDARD_MODEL
    budget = _parse_budget(budget_text)
    if budget is not None and budget >= 2000:
        return PREMIUM_MODEL
    return STANDARD_MODEL


def _mock_response(title: str, direction: str | None) -> dict[str, Any]:
    return {
        "proposal": (
            f"Hi — I read through \"{title}\" and the scope is clear. "
            f"I'm a senior full-stack developer (React, Next.js, Node, FastAPI) and I've shipped similar work end-to-end. "
            f"My approach: clarify requirements, build in small milestones, and keep you updated with demos. "
            f"{direction or 'Happy to discuss details in Freelancer chat.'}"
        ),
        "bid_amount": 1200,
        "delivery_days": 14,
        "questions": [
            "Do you have existing designs or should we align on UI first?",
            "What's your preferred timeline for the first milestone?",
        ],
        "feasibility": "full",
        "risk_score": 20,
        "risk_notes": "Scope looks reasonable; verify client history before committing.",
        "fit_score": 85,
        "key_requirements": ["Full-stack development", "Clear communication"],
    }


def _mock_analyze(title: str) -> dict[str, Any]:
    return {
        "risk_score": 25,
        "risk_notes": "Standard project; verify client reviews.",
        "fit_score": 80,
        "key_requirements": ["Review scope", "Confirm timeline"],
        "summary": f"Project '{title}' appears to be a typical freelance job with reasonable scope.",
    }


async def analyze_project(
    *,
    title: str,
    description: str,
    budget_text: str | None,
    skills: list[str],
) -> dict[str, Any]:
    if not settings.openai_api_key:
        return _mock_analyze(title)

    client = OpenAI(api_key=settings.openai_api_key)
    user_content = f"Title: {title}\nBudget: {budget_text or 'N/A'}\nSkills: {', '.join(skills)}\n\n{description[:2000]}"
    from prompts import ANALYZE_PROMPT
    response = _chat_completion(
        client,
        model=STANDARD_MODEL,
        messages=[
            {"role": "system", "content": ANALYZE_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    return json.loads(response.choices[0].message.content or "{}")


async def generate_bid_content(
    *,
    title: str,
    description: str,
    budget_text: str | None,
    skills: list[str],
    direction: str | None,
    model_tier: str,
    profile: dict | None = None,
    templates: list[dict] | None = None,
) -> tuple[dict[str, Any], str]:
    model = resolve_model(model_tier, budget_text)

    if not settings.openai_api_key:
        return _mock_response(title, direction), "mock"

    client = OpenAI(api_key=settings.openai_api_key)
    p = profile or {}
    profile_data = {
        "display_name": p.get("display_name") or DEFAULT_PROFILE.get("display_name", "Kareem"),
        "title": p.get("title") or DEFAULT_PROFILE["title"],
        "skills": p.get("skills") or DEFAULT_PROFILE["skills"],
        "proposal_style": p.get("proposal_style") or DEFAULT_PROFILE["proposal_style"],
    }

    system = SYSTEM_PROMPT.format(
        display_name=profile_data["display_name"],
        title=profile_data["title"],
        skills=", ".join(profile_data["skills"]) if isinstance(profile_data["skills"], list) else profile_data["skills"],
        proposal_style=profile_data["proposal_style"],
    )

    user_content = f"""Project title: {title}

Budget: {budget_text or "Not specified"}
Skills: {", ".join(skills) if skills else "Not specified"}

Description:
{description}

User direction:
{direction or "Make it confident and human. Ask to discuss in Freelancer chat."}
"""
    if templates:
        examples = "\n\n---\n".join(t.get("content", "")[:500] for t in templates[:2])
        user_content += f"\n\nWinning proposal examples:\n{examples}"

    response = _chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    return _finalize_bid_payload(data, title, description), model
