# BidAutomation

Premium Freelancer bidding assistant — Chrome extension + API + dashboard.

## What's included

- **Chrome Extension** — bid panel, listing watcher, proposal fill
- **FastAPI Backend** — AI generation, Supabase persistence, profile API
- **Next.js Dashboard** — auth, projects, proposals, analytics, settings
- **Supabase** — PostgreSQL for projects, bids, profiles (optional in dev)

## Quick start

### 1. Backend

```bash
cd apps/api
py -m pip install -r requirements.txt
copy .env.example .env
py -m uvicorn main:app --reload --port 8000
```

### 2. Supabase (for persistent storage)

See **[docs/supabase-setup.md](docs/supabase-setup.md)** — create project, run migration, copy keys.

### 3. Dashboard

```bash
cd apps/dashboard
copy .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

### 4. Chrome Extension

```bash
cd apps/extension
npm run build
```

Load `apps/extension/dist` in `chrome://extensions` (Developer mode).

### 5. Connect extension to your account

1. Sign in at http://localhost:3000 (each user uses their own account)
2. Open **Connect extension** in the sidebar (or Settings → Extension)
3. Click **Connect extension** on that page (use Chrome, where the extension is installed)
4. If auto-connect fails: paste the copied token in the extension popup → **Auth token** → **Save**

Optional one-click connect: add your extension ID to `apps/dashboard/.env.local`:

```env
NEXT_PUBLIC_EXTENSION_ID=your_id_from_chrome_extensions
```

Restart the dashboard after changing `.env.local`.

## Dev mode (no Supabase)

- Leave Supabase env vars empty
- API uses in-memory store with `dev-token`
- Dashboard works without login

## Project structure

```
apps/api/          FastAPI backend
apps/dashboard/    Next.js dashboard + Supabase auth
apps/extension/    Chrome MV3 extension
supabase/          SQL migrations
docs/              Setup guides
```
