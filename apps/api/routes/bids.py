from fastapi import APIRouter, Depends, HTTPException, Query

from auth import AuthContext, get_auth
from models import AnalyzeRequest, BidUpdateRequest, GenerateBidRequest, SubmitBidRequest
from services import ai, store

router = APIRouter(prefix="/bids", tags=["bids"])


@router.get("")
async def list_bids(
    project_id: str | None = None,
    auth: AuthContext = Depends(get_auth),
):
    bids = store.list_all_bids(auth.user_id, project_id, persistent=auth.persistent)
    all_projects, _ = store.list_projects(auth.user_id, limit=10000, persistent=auth.persistent)
    projects = {p["id"]: p for p in all_projects}
    enriched = []
    for bid in bids:
        project = projects.get(bid["project_id"], {})
        enriched.append({**bid, "project_title": project.get("title"), "project_url": project.get("url")})
    return {"bids": enriched}


@router.get("/{bid_id}")
async def get_bid(bid_id: str, auth: AuthContext = Depends(get_auth)):
    bid = store.get_bid(auth.user_id, bid_id, persistent=auth.persistent)
    if not bid:
        raise HTTPException(404, "Bid not found")
    return {"bid": bid}


@router.patch("/{bid_id}")
async def patch_bid(
    bid_id: str, body: BidUpdateRequest, auth: AuthContext = Depends(get_auth)
):
    bid = store.update_bid(
        auth.user_id, bid_id, body.model_dump(exclude_none=True), persistent=auth.persistent
    )
    if not bid:
        raise HTTPException(404, "Bid not found")
    return {"bid": bid}


@router.post("/analyze")
async def analyze(body: AnalyzeRequest, auth: AuthContext = Depends(get_auth)):
    result = await ai.analyze_project(
        title=body.title,
        description=body.description,
        budget_text=body.budget_text,
        skills=body.skills,
    )
    return result


@router.post("/generate")
async def generate_bid(body: GenerateBidRequest, auth: AuthContext = Depends(get_auth)):
    profile = store.get_profile(auth.user_id, persistent=auth.persistent)
    direction = body.direction or (profile or {}).get("default_direction")
    templates = store.get_winning_templates(auth.user_id, persistent=auth.persistent)

    project = None
    if body.project_id:
        project = store.get_project(auth.user_id, body.project_id, persistent=auth.persistent)
    elif body.freelancer_project_id and body.url:
        project = store.upsert_project(auth.user_id, {
            "freelancer_project_id": body.freelancer_project_id,
            "url": body.url,
            "title": body.title,
            "description": body.description,
            "budget_text": body.budget_text,
            "budget_type": body.budget_type,
            "skills": body.skills,
            "clarifications": body.clarifications,
            "status": "viewed",
        }, persistent=auth.persistent)
    else:
        project = store.upsert_project(auth.user_id, {
            "freelancer_project_id": body.freelancer_project_id or body.title[:50].replace(" ", "-").lower(),
            "url": body.url or "",
            "title": body.title,
            "description": body.description,
            "budget_text": body.budget_text,
            "budget_type": body.budget_type,
            "skills": body.skills,
            "clarifications": body.clarifications,
            "status": "viewed",
        }, persistent=auth.persistent)

    if body.analyze_only:
        result = await ai.analyze_project(
            title=body.title, description=body.description,
            budget_text=body.budget_text, skills=body.skills,
        )
        if project:
            store.update_project(auth.user_id, project["id"], {
                "risk_score": result.get("risk_score"),
                "risk_notes": result.get("risk_notes"),
            }, persistent=auth.persistent)
        return {"project_id": project["id"], **result}

    try:
        content, model_used = await ai.generate_bid_content(
            title=body.title,
            description=body.description,
            budget_text=body.budget_text,
            skills=body.skills,
            direction=direction,
            model_tier=body.model_tier,
            profile=profile,
            templates=templates,
        )
    except ai.AIServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    if project:
        store.update_project(auth.user_id, project["id"], {
            "risk_score": content.get("risk_score"),
            "risk_notes": content.get("risk_notes"),
        }, persistent=auth.persistent)

    bid = store.create_bid(auth.user_id, project["id"], {
        "proposal_text": content.get("proposal", ""),
        "bid_amount": content.get("bid_amount"),
        "delivery_days": content.get("delivery_days"),
        "questions": content.get("questions", []),
        "direction": direction,
        "model_used": model_used,
        "model_tier": body.model_tier,
    }, persistent=auth.persistent)

    return {
        "bid_id": bid["id"],
        "project_id": project["id"],
        "proposal": bid["proposal_text"],
        "bid_amount": bid["bid_amount"],
        "delivery_days": bid["delivery_days"],
        "questions": bid["questions"],
        "risk_score": content.get("risk_score"),
        "risk_notes": content.get("risk_notes"),
        "feasibility": content.get("feasibility"),
        "fit_score": content.get("fit_score"),
        "key_requirements": content.get("key_requirements", []),
        "model_used": model_used,
    }


@router.post("/submit")
async def submit_bid_route(body: SubmitBidRequest, auth: AuthContext = Depends(get_auth)):
    result = store.submit_bid(
        auth.user_id,
        body.model_dump(),
        persistent=auth.persistent,
    )
    return result


@router.post("/{bid_id}/regenerate")
async def regenerate_bid(
    bid_id: str,
    direction: str | None = Query(None),
    model_tier: str = Query("auto"),
    auth: AuthContext = Depends(get_auth),
):
    old = store.get_bid(auth.user_id, bid_id, persistent=auth.persistent)
    if not old:
        raise HTTPException(404, "Bid not found")
    project = store.get_project(auth.user_id, old["project_id"], persistent=auth.persistent)
    if not project:
        raise HTTPException(404, "Project not found")

    profile = store.get_profile(auth.user_id, persistent=auth.persistent)
    templates = store.get_winning_templates(auth.user_id, persistent=auth.persistent)
    dir_text = direction or old.get("direction") or (profile or {}).get("default_direction")

    content, model_used = await ai.generate_bid_content(
        title=project["title"],
        description=project.get("description", ""),
        budget_text=project.get("budget_text"),
        skills=project.get("skills", []),
        direction=dir_text,
        model_tier=model_tier,
        profile=profile,
        templates=templates,
    )

    bid = store.create_bid(auth.user_id, project["id"], {
        "proposal_text": content.get("proposal", ""),
        "bid_amount": content.get("bid_amount"),
        "delivery_days": content.get("delivery_days"),
        "questions": content.get("questions", []),
        "direction": dir_text,
        "model_used": model_used,
        "model_tier": model_tier,
    }, persistent=auth.persistent)

    return {
        "bid_id": bid["id"],
        "project_id": project["id"],
        "proposal": bid["proposal_text"],
        "bid_amount": bid["bid_amount"],
        "delivery_days": bid["delivery_days"],
        "questions": bid["questions"],
        "risk_score": content.get("risk_score"),
        "risk_notes": content.get("risk_notes"),
        "feasibility": content.get("feasibility"),
        "fit_score": content.get("fit_score"),
        "key_requirements": content.get("key_requirements", []),
        "model_used": model_used,
    }
