# Helm Windows installer

Creates **HelmSetup.exe** — installs API, dashboard, and configures PostgreSQL database **`bidautomation`**.

The Chrome extension is **not** included (load manually).

## What gets installed

| Component | Location after install |
|-----------|-------------------------|
| API (FastAPI + Python venv) | `C:\Program Files\Helm\api\` |
| Dashboard (Next.js production) | `C:\Program Files\Helm\dashboard\` |
| Launcher scripts | `C:\Program Files\Helm\scripts\` |
| Config | `apps\api\.env`, `dashboard\.env.local` |
| PostgreSQL database | **`bidautomation`** on `localhost:5432` |

Schema migrations run automatically when the API starts.

## Prerequisites on the target PC

**Easy way:** double-click **`install-prerequisites.bat`** (in the repo under `installer\`, or Start Menu → **Install prerequisites** after HelmSetup).

| Script | Installs |
|--------|----------|
| `installer\install-prerequisites.bat` | Node.js LTS + PostgreSQL |
| `installer\scripts\install-node.bat` | Node.js only |
| `installer\scripts\install-postgres.bat` | PostgreSQL only |

Uses **winget** when available (Windows 10/11); falls back to **Chocolatey** or opens the official download page.

**PostgreSQL:** the installer GUI will ask you to set the **`postgres`** user password — save it for Helm setup. Database **`bidautomation`** is created later by Configure Helm.

**Manual install** (if scripts fail):

1. **PostgreSQL 14+** — [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. **Node.js 20+** — [nodejs.org](https://nodejs.org/)

Python is **bundled** inside `Helm\api\venv` (no separate Python install needed).

## Build the setup file (on your dev machine)

```powershell
# From repo root
powershell -ExecutionPolicy Bypass -File installer\build-release.ps1
```

Install [Inno Setup 6](https://jrsoftware.org/isinfo.php), then:

```powershell
# Default ISCC path; adjust if needed
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\HelmSetup.iss
```

Output: **`installer\output\HelmSetup.exe`**

## End-user install flow

1. Run **`install-prerequisites.bat`** (Node.js + PostgreSQL) — or use Start Menu → **Install prerequisites** after HelmSetup.
2. Run **HelmSetup.exe** as administrator.
3. Setup wizard prompts for:
   - PostgreSQL `postgres` password
   - Helm admin email / password
   - OpenAI API key (optional)
4. Creates database **`bidautomation`** if missing.
5. Start Menu → **Start Helm** → browser opens `http://localhost:3001`.
6. Load the Chrome extension manually and connect from the dashboard.

## Start Menu shortcuts

- **Start Helm** — API + dashboard + open browser
- **Stop Helm** — stop background processes
- **Install prerequisites** — Node.js + PostgreSQL (winget)
- **Configure Helm** — re-run setup (rewrite `.env`)
- **Open Dashboard** — `http://localhost:3001`

## Database note

The connection string uses database name **`bidautomation`** (legacy name from the project):

```
postgresql://postgres:YOUR_PASSWORD@localhost:5432/bidautomation
```

This matches `apps/api/.env.example`. Renaming to `helm` later would only require a new database + updated `DATABASE_URL`.

## Troubleshooting

- **Prerequisites failed** — run **Install prerequisites** from Start Menu (or `scripts\install-prerequisites.bat`), ensure PostgreSQL service is running.
- **API won't start** — check `C:\Program Files\Helm\api\.env` and PostgreSQL password.
- **Port in use** — run **Stop Helm** first.
- Re-run **Configure Helm** to reset credentials.
