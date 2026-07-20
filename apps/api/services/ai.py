import asyncio
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
PREMIUM_MODEL = "gpt-4.1"

# Models the user can pick on the settings screen. Kept as an allowlist so an
# arbitrary/invalid model name can never reach the OpenAI API.
SELECTABLE_MODELS = (
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-5",
)


def _is_reasoning_model(model: str) -> bool:
    """gpt-5 and o-series models reject non-default temperature."""
    return model.startswith(("gpt-5", "o1", "o3", "o4"))


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


def _normalize_questions_from_payload(data: dict[str, Any], limit: int = 3) -> list[str]:
    for key in ("questions", "strategic_questions", "client_questions"):
        raw = data.get(key)
        if raw is None:
            continue
        if isinstance(raw, str):
            lines = [line.strip().lstrip("-–•").strip() for line in raw.split("\n") if line.strip()]
            if lines:
                return lines[:limit]
        if isinstance(raw, list):
            items = [str(q).strip().lstrip("-–•").strip() for q in raw if str(q).strip()]
            if items:
                return items[:limit]
    return []


def _fallback_questions(title: str) -> list[str]:
    topic = title.strip() or "this project"
    return [
        f"What would a successful first delivery look like for {topic}?",
        "Are there integrations, compliance rules, or workflow constraints we should confirm before build starts?",
        "Who are the main users, and what is the one outcome this has to get right?",
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


_PLEASE_RE = re.compile(r"\bplease\b", re.IGNORECASE)


def _shorten_please(text: str) -> str:
    """Replace 'Please'/'please' with 'Pls'/'pls', preserving capitalization."""
    def repl(match: re.Match[str]) -> str:
        return "Pls" if match.group(0)[0].isupper() else "pls"

    return _PLEASE_RE.sub(repl, text or "")


def _ensure_signoff(proposal: str, display_name: str) -> str:
    """Guarantee the proposal ends with a plain 'Thanks' sign-off (no name)."""
    text = (proposal or "").rstrip()
    if not text:
        return text
    lines = text.splitlines()
    name = (display_name or "").strip().lower()
    # Drop a trailing name line if the model still signed with the name.
    if name and lines[-1].strip().lower() == name:
        lines.pop()
        while lines and not lines[-1].strip():
            lines.pop()
        text = "\n".join(lines).rstrip()
        lines = text.splitlines()
    # Already ends with "Thanks" (with or without a comma)? Leave it.
    if lines and lines[-1].strip().lower().rstrip(",") == "thanks":
        return text
    return f"{text}\n\nThanks"


def _soft_trim_proposal(proposal: str, limit: int = 2000) -> str:
    """Trim only if extremely long, and only at a sentence/paragraph boundary."""
    text = proposal.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    boundary = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"), cut.rfind("\n"))
    if boundary > 400:
        return cut[: boundary + 1].rstrip()
    return cut.rstrip()


def _finalize_bid_payload(
    data: dict[str, Any],
    title: str,
    description: str = "",
    display_name: str = "",
    question_count: int = 3,
) -> dict[str, Any]:
    proposal = _soft_trim_proposal(data.get("proposal") or "")
    proposal = _shorten_please(proposal)
    data["proposal"] = _ensure_signoff(proposal, display_name)

    questions = _normalize_questions_from_payload(data, limit=question_count)
    if len(questions) < question_count:
        for fallback in _fallback_questions(title):
            if len(questions) >= question_count:
                break
            if fallback not in questions:
                questions.append(fallback)
    data["questions"] = questions[:question_count]

    _normalize_bid_numbers(data)
    data["feasibility"] = _normalize_feasibility(data)
    return data


async def _chat_completion(client: OpenAI, **kwargs: Any):
    # Run the blocking OpenAI SDK call in a worker thread so it does not freeze
    # the async event loop while a proposal generates (other requests stay live).
    try:
        return await asyncio.to_thread(client.chat.completions.create, **kwargs)
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


def resolve_model(tier: str, budget_text: str | None, override_model: str | None = None) -> str:
    if tier == "standard":
        return STANDARD_MODEL
    # "premium" or auto: use the user's chosen model when it's a valid pick,
    # otherwise fall back to the top model for best quality.
    if override_model and override_model in SELECTABLE_MODELS:
        return override_model
    return PREMIUM_MODEL


def _mock_response(title: str, direction: str | None) -> dict[str, Any]:
    closing = (direction.strip() if isinstance(direction, str) else "")
    proposal = (
        f"Hi — I read through \"{title}\" and the scope is clear. "
        f"I'm a senior full-stack developer (React, Next.js, Node, FastAPI) and I've shipped similar work end-to-end. "
        f"My approach: clarify requirements, build in small milestones, and keep you updated with demos."
    )
    if closing:
        proposal = f"{proposal} {closing}"
    return {
        "proposal": proposal,
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
    response = await _chat_completion(
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
    p = profile or {}
    question_count = p.get("question_count")
    try:
        question_count = int(question_count)
    except (TypeError, ValueError):
        question_count = DEFAULT_PROFILE.get("question_count", 3)
    if question_count not in (2, 3):
        question_count = 3
    proposal_model = p.get("proposal_model") or DEFAULT_PROFILE.get("proposal_model")
    model = resolve_model(model_tier, budget_text, override_model=proposal_model)

    if not settings.openai_api_key:
        return _mock_response(title, direction), "mock"

    client = OpenAI(api_key=settings.openai_api_key)
    profile_data = {
        "display_name": p.get("display_name") or DEFAULT_PROFILE.get("display_name", "Kareem"),
        "title": p.get("title") or DEFAULT_PROFILE["title"],
        "skills": p.get("skills") or DEFAULT_PROFILE["skills"],
        "proposal_style": p.get("proposal_style") or DEFAULT_PROFILE["proposal_style"],
    }

    question_word = "two" if question_count == 2 else "three"
    questions_example = ", ".join(
        f'"sharp question {i}"' for i in range(1, question_count + 1)
    )
    system = SYSTEM_PROMPT.format(
        display_name=profile_data["display_name"],
        title=profile_data["title"],
        skills=", ".join(profile_data["skills"]) if isinstance(profile_data["skills"], list) else profile_data["skills"],
        proposal_style=profile_data["proposal_style"],
        question_count=question_count,
        question_word=question_word,
        questions_example=questions_example,
    )

    user_content = f"""Project title: {title}

Budget: {budget_text or "Not specified"}
Skills: {", ".join(skills) if skills else "Not specified"}

Description:
{description}

User direction:
{direction if direction is not None else "Make it confident, human, and natural. Follow the user's rules exactly. Do not force any specific CTA or platform mention unless asked."}
"""
    if templates:
        examples = "\n\n---\n".join(t.get("content", "")[:500] for t in templates[:2])
        user_content += f"\n\nWinning proposal examples:\n{examples}"

    completion_kwargs: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
    }
    # gpt-5 / reasoning models only accept the default temperature.
    if not _is_reasoning_model(model):
        # Higher temperature keeps proposals warm and worded differently each time.
        completion_kwargs["temperature"] = 0.85

    response = await _chat_completion(client, **completion_kwargs)

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    return _finalize_bid_payload(
        data, title, description, display_name=profile_data["display_name"],
        question_count=question_count,
    ), model
