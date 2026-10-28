# Jobly Deployment Runbook

How this app gets deployed to Azure, written up so another agent/operator can run it without re-deriving it from scratch.

## Architecture

Three independent pieces, three independent deploy paths:

| Piece | Where it runs | How it deploys |
|---|---|---|
| Frontend (public site + `/portal` SPA) | Azure Static Web App | Push to `main` → GitHub Actions auto-builds and deploys |
| Backend (Express API) | Azure App Service (Linux, container) | Manual: build Docker image → push to Docker Hub → point the Web App at the new digest → restart |
| Database | Supabase (Postgres) | Manual: apply a `.sql` migration via Supabase MCP/CLI |

There is **no infrastructure-as-code** (no Bicep/Terraform/ARM templates) — every resource already exists and deploys just push new code/images into it. Nothing here provisions new Azure resources.

## Resource inventory

| Resource | Name | Resource Group | Notes |
|---|---|---|---|
| Azure subscription | `Azure for Students` | — | Subscription ID `2bcf4229-f57d-4f80-9685-874faa49d4df` |
| Static Web App (frontend) | `jobly` | `apis` | Hostname `https://yellow-sea-0a9088500.6.azurestaticapps.net` |
| App Service (backend) | `prashanthreddy` | `apis` | Hostname `https://prashanthreddy-hndndtdfhkdjhwft.eastasia-01.azurewebsites.net`, kind `app,linux,container` |
| Docker Hub image | `prashanth1710/jobly-backend:latest` | — | Public Docker Hub repo the App Service pulls from |
| Supabase project | `ufkrfrmqangydrjbzljo` | — | Referenced as `project_id` in Supabase MCP calls |
| GitHub repo | `Sai-Prashanth123/jobly-clone-project` | — | `main` branch is what both CI/CD and manual deploys read from |

Prerequisites on whatever machine runs these commands:
- `az` CLI, logged in (`az login`) with access to the subscription above.
- `gh` CLI, authenticated (`gh auth status`), with push access to the repo.
- `docker` (Desktop or daemon) running and logged into Docker Hub with push access to `prashanth1710/jobly-backend`.
- Supabase MCP server connected (or the Supabase CLI / dashboard SQL editor as a fallback — see below).

---

## Frontend deploy (Azure Static Web Apps)

100% automatic — there is no manual `az` step for the frontend. The workflow file is `.github/workflows/azure-static-web-apps-yellow-sea-0a9088500.yml`:

```yaml
on:
  push:
    branches: [main]
# build: app_location "/", output_location "dist" (Vite build), no api_location
# deploys via Azure/static-web-apps-deploy@v1 using a secret
# (AZURE_STATIC_WEB_APPS_API_TOKEN_YELLOW_SEA_0A9088500) already stored in the repo
```

**To deploy the frontend:**
```bash
git add <files>
git commit -m "..."
git push origin main
```

That push alone triggers the GitHub Actions run. **Nothing else is required.**

**To watch it:**
```bash
gh run list --limit 3                      # find the run id for your push
gh run watch <run-id> --exit-status         # blocks until it finishes, exit 0/1
```

**Known failure mode (seen repeatedly this session, not a code problem):** the run gets stuck `queued` for 15+ minutes and then fails with the annotation *"The job was not acquired by Runner of type hosted even after multiple attempts."* This is a transient GitHub-hosted-runner capacity issue, not anything wrong with the app or the workflow. Fix: just retry.
```bash
gh run rerun <run-id>
```
It sometimes takes 2-3 retries in a row during a GitHub incident. If it's still failing after that, stop and flag it — don't keep retrying indefinitely.

**To verify it actually shipped:** don't trust `index-*.js`'s hash alone (Vite fingerprints unrelated files too, so a change in one page's build hash isn't proof your change is live). Check a lazily-loaded chunk that corresponds directly to the page you changed (e.g. `NewEmployee-*.js`) has a new hash vs the previous deploy, or just load the live page and confirm the behavior.

---

## Backend deploy (Docker → Azure App Service)

No CI/CD for the backend — every deploy is a manual sequence. Run from the repo root.

### 0. Preconditions
```bash
docker info > /dev/null 2>&1 && echo OK || echo "Docker not running — start Docker Desktop first"
```

### 1. Capture the current image digest (for rollback)
```bash
az webapp config show -n prashanthreddy -g apis --query linuxFxVersion -o tsv
# → DOCKER|prashanth1710/jobly-backend@sha256:<CURRENT_DIGEST>
```
Write this down. If the new deploy goes wrong, you can instantly revert with step 4 using this old digest.

### 2. Build and push the image
```bash
docker buildx build --no-cache --platform linux/amd64 -t prashanth1710/jobly-backend:latest --push backend/
```
- `--platform linux/amd64` is required — the App Service is amd64 Linux; building on an arm64 dev machine (e.g. Apple Silicon) without this flag produces an image the App Service can't run.
- `--no-cache` is deliberate — this codebase has occasionally hit a transient `npm ci` failure inside the build ("Exit handler never called! This is an error with npm itself") that leaves a broken layer if cached; a clean build sidesteps it. If a build fails with that exact npm error, it's not your code — just retry the same command.
- Expect ~5-9 minutes total (2 min each for the two `npm ci` layers, ~30s image export, several minutes pushing layers to Docker Hub depending on link speed).
- The command prints the new digest near the end:
  ```
  #21 pushing manifest for docker.io/prashanth1710/jobly-backend:latest@sha256:<NEW_DIGEST>
  ```
  Copy `<NEW_DIGEST>` (the `sha256:...` value) — you need it for the next step.

### 3. Point the Web App at the new image
```bash
az webapp config set -n prashanthreddy -g apis --linux-fx-version "DOCKER|prashanth1710/jobly-backend@sha256:<NEW_DIGEST>"
```
Pin by digest, not by the `:latest` tag — `az webapp restart` alone will NOT pick up a `:latest` tag update; the App Service caches the digest it was last told to run. You must explicitly repoint it every deploy.

### 4. Restart
```bash
az webapp restart -n prashanthreddy -g apis
```

### 5. Poll until healthy
```bash
for i in $(seq 1 20); do
  resp=$(curl -s -m 5 https://prashanthreddy-hndndtdfhkdjhwft.eastasia-01.azurewebsites.net/health)
  echo "attempt $i: $resp"
  echo "$resp" | grep -q '"status":"ok"' && echo HEALTHY && break
  sleep 10
done
```
Expected final response: `{"status":"ok","db":"connected","timestamp":"...","env":"production"}`. Cold start after a restart typically takes 60-90 seconds; the loop above allows up to ~3 minutes.

### Rollback
If the new deploy is broken, repeat steps 3-5 with the digest you captured in step 1.

---

## Database migrations (Supabase)

Migration files live in `backend/supabase/migrations/NNN_description.sql`, numbered sequentially (currently up to `031_invoice_timesheets_unique.sql`). They are **plain SQL**, not a framework-specific format.

**Ordering rule:** if a backend code change references a new column/constraint/type, the migration MUST be applied before that backend image is deployed (steps above) — otherwise every request touching that code path will fail with a Postgres "column does not exist" error. Migrate first, then deploy the backend.

**Applying a migration (this session's method — Supabase MCP):**
The Supabase MCP server (`plugin:supabase:supabase`) exposes an `apply_migration` tool:
```
apply_migration(project_id="ufkrfrmqangydrjbzljo", name="<snake_case_name>", query="<the .sql file's contents>")
```
This requires the MCP server to be connected in the operating agent's session. If it shows as disconnected, reconnecting it is an environment-specific step (in Claude Code, the local `/mcp` slash command reconnects it) — not something scriptable via `az` or `gh`.

**Fallback if MCP isn't available to the other agent** — either works:
- **Supabase CLI**: `supabase db push` (needs `supabase link` to the project first, and a service-role/DB password).
- **Supabase Dashboard**: paste the migration SQL into the SQL Editor for project `ufkrfrmqangydrjbzljo` and run it directly.
- Note: the direct Postgres connection string (`DATABASE_URL`/`DIRECT_URL`, already set as App Service settings) is on an **IPv6-only host** — `psql` from a typical IPv4-only dev machine/CI runner will fail to connect. The MCP tool and the Supabase dashboard both go through Supabase's HTTPS API instead and don't have this problem.

**Verify a migration landed**, e.g.:
```sql
select column_name, data_type from information_schema.columns
where table_name = 'employees' and column_name = '<new_column>';
```

---

## Environment variables (backend App Service)

Already configured as App Service settings on `prashanthreddy` — listed here for reference only, values are secrets and were not printed:

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`, `FRONTEND_URL`, `AZURE_COMM_CONNECTION_STRING` (mailer — Azure Communication Services Email; the app degrades gracefully with a banner if unset, it does not crash), `ACS_SENDER_ADDRESS`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `ENABLE_SCHEDULER`, plus Azure/App-Service-managed ones (`DOCKER_ENABLE_CI`, `DOCKER_REGISTRY_SERVER_URL`, `WEBSITE_*`).

A fresh deploy of the *same* image/config never needs to touch these — they're only relevant if a code change introduces a **new** required env var, in which case add it with:
```bash
az webapp config appsettings set -n prashanthreddy -g apis --settings KEY="value"
```

## Full deploy checklist (copy/paste order for a typical change)

1. Make code changes, commit.
2. If there's a new migration: apply it (Supabase MCP/CLI/dashboard) and confirm it landed.
3. If backend files changed: run the 5-step Docker sequence above.
4. `git push origin main` (triggers frontend deploy regardless of whether frontend files changed — harmless no-op rebuild if not).
5. `gh run watch <run-id> --exit-status`; `gh run rerun <run-id>` once or twice if it hits the GitHub-runner-capacity issue.
6. Confirm backend `/health` is green and the live site reflects the change.
