# Helm

Freelancer workspace — Chrome extension + API + dashboard.

## What's included

- **Chrome Extension** — bid panel, listing watcher, proposal fill
- **FastAPI Backend** — AI generation, Supabase persistence, profile API
- **Next.js Dashboard** — auth, projects, proposals, analytics, settings
- **Supabase** — PostgreSQL for projects, bids, profiles (optional in dev)

## Install on a new Windows PC (one click)

1. Copy or `git clone` this project to the new PC (for example `C:\Helm`). Don't copy `node_modules`, `.next` or `.venv`; they are rebuilt.
2. Double-click **`INSTALL-HELM.bat`** and approve the Administrator prompt.
3. Answer the questions: a PostgreSQL password, your Helm login email and password, and your OpenAI key (optional).
   After that, setup runs by itself (10–20 minutes). It:
   - installs Python 3.12, Node.js LTS, PostgreSQL and Chrome
   - creates the `bidautomation` database and writes both `.env` files
   - builds the dashboard and the extension
   - registers the **Helm Auto Start** task, which starts Helm 20 s after every sign-in and restarts it if it crashes
4. Load the extension in Chrome: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and choose `apps\extension\dist`.
   Then open **Connect extension** in the dashboard.

Desktop shortcuts: **Helm Dashboard**, **Start Helm**, **Stop Helm**.
Logs are in `%ProgramData%\Helm\logs`.
Re-run `INSTALL-HELM.bat` after pulling updates; it keeps your settings and rebuilds.

## Quick start (development)

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

Open http://localhost:3001

### 4. Chrome Extension

```bash
cd apps/extension
npm run build
```

Load `apps/extension/dist` in `chrome://extensions` (Developer mode).

### 5. Connect extension to your account

1. Sign in at http://localhost:3001 (each user uses their own account)
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
