from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import admin, analytics, auth, bids, misc, profile, projects
from services import memory_store, store

app = FastAPI(
    title="BidAutomation API",
    description="Freelancer bidding assistant API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"] if settings.dev_mode else settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(misc.router)
app.include_router(misc.watcher_router)
app.include_router(misc.filter_router)
app.include_router(misc.template_router)
app.include_router(projects.router)
app.include_router(bids.router)
app.include_router(analytics.router)
app.include_router(profile.router)


@app.on_event("startup")
async def load_local_data():
    if settings.postgres_configured:
        from services import postgres_db

        postgres_db.init_schema()
        if settings.migrate_json_on_startup:
            from scripts.migrate_store_json import migrate_if_needed

            migrate_if_needed()
    elif settings.local_persistence and not settings.supabase_configured:
        memory_store.init_from_disk()

    if settings.local_auth_enabled and settings.admin_email and settings.admin_password:
        from services.passwords import hash_password

        store.ensure_admin_user(
            settings.admin_email,
            hash_password(settings.admin_password),
        )


@app.on_event("shutdown")
async def shutdown():
    if settings.postgres_configured:
        from services import postgres_db

        postgres_db.close_pool()


@app.get("/health")
async def health():
    if settings.postgres_configured:
        storage = "postgres"
    elif settings.supabase_configured:
        storage = "supabase"
    elif settings.local_persistence:
        storage = "local-file"
    else:
        storage = "memory"
    return {
        "status": "ok",
        "dev_mode": settings.dev_mode,
        "local_auth_enabled": settings.local_auth_enabled,
        "ai_configured": bool(settings.openai_api_key),
        "supabase_configured": settings.supabase_configured,
        "postgres_configured": settings.postgres_configured,
        "storage": storage,
    }
