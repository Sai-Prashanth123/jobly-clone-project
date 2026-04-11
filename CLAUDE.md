# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Commands

### Frontend (root directory)
```bash
npm run dev          # Start Vite dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest tests once
npm run test:watch   # Vitest in watch mode
npm run test -- src/test/example.test.ts   # Run a single test file
npm run test -- -t "name of test"          # Filter by test name
```

### Backend (`backend/` directory)
```bash
cd backend
npm run dev          # nodemon + ts-node (watches src/)
npm run build        # tsc → dist/
npm run start        # Run compiled dist/server.js
npm run seed         # Seed Supabase with demo data (tsx src/scripts/seed.ts)
```

### Environment setup
- Frontend: `.env.local` at root — only `VITE_API_URL=http://localhost:3001/api/v1`
- Backend: `backend/.env` — requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `FRONTEND_URL`, `PORT`
- Backend validates env vars at startup via Zod (`backend/src/config/env.ts`) and exits if invalid

---

## Architecture Overview

This is a **two-application monorepo** in a single directory:

### 1. Public Marketing Site (`src/pages/`, `src/components/`)
A Bootstrap/jQuery-era template converted to React. Uses the legacy CSS stack:
- **CSS**: `src/styles/` contains vendor CSS files (bootstrap, slick, animate, icons) imported in `src/main.tsx`. Custom overrides go in `src/index.css`.
- **jQuery plugins**: Loaded via `src/lib/vendors/index.ts`. Vite's `injectJQueryGlobal` plugin in `vite.config.ts` wraps each vendor file to expose `$`/`jQuery` globals safely in ESM context. Slick carousel is special-cased (proper UMD).
- **Icons**: The site uses Font Awesome Free 5.x (CDN, `fas`/`far`/`fab` only — NOT `fal` which is Pro). Custom icon fonts `consulter` and `flaticon` require font files that **do not exist** in the repo; replace any `icon-*` class with FA equivalents.
- **No Tailwind** on the public site — Bootstrap grid classes (`d-none`, `d-xl-block`, `col-*`) control layout.

### 2. Workforce Management Portal (`src/portal/`)
A fully isolated React SPA mounted at `/portal/*` via lazy import. Has its own:
- **Styling**: `portal.css` scoped under `.portal-scope` resets the landing-page CSS. UI is shadcn/ui (Radix primitives + Tailwind).
- **State**: TanStack Query for all server state. A separate `queryClient` lives in `src/portal/lib/queryClient.ts`.
- **Auth**: JWT stored in `sessionStorage` (`jobly_session` + `access_token` keys). `AuthContext` provides `login`/`logout`/`user`. The `apiClient` Axios instance auto-attaches the Bearer token and redirects to `/portal/login` on 401.
- **RBAC**: Five roles — `admin`, `hr`, `operations`, `finance`, `employee`. `ProtectedRoute` enforces `allowedRoles` on the frontend; `requireRole(...roles)` middleware enforces it on the backend.

### 3. Backend (`backend/src/`)
Express + TypeScript REST API at `http://localhost:3001/api/v1`.
- **Database**: Supabase (PostgreSQL). All queries use `supabaseAdmin` (service role) from `backend/src/config/supabase.ts`.
- **Request flow**: `authenticate` middleware → `requireRole` middleware → controller → service → Supabase.
- **Validation**: Zod schemas in `backend/src/schemas/` validate request bodies. `validate(schema)` middleware runs before controllers.
- **PDF generation**: pdfkit writes to a buffer, uploads to Supabase Storage, returns a signed URL.
- **Email**: `backend/src/lib/mailer.ts` uses **nodemailer + Gmail SMTP** (requires `GMAIL_USER` and `GMAIL_APP_PASSWORD` env vars — generate an App Password in the Google account security settings). The `resend` package is still installed but is no longer the active transport.
- **Activity logging**: `backend/src/lib/activityLogger.ts` — call `logActivity()` in services for audit trail.

---

## Key Conventions

### Data mapping (frontend hooks)
Every `useXxx` hook in `src/portal/hooks/` contains a `mapXxx(raw)` function that translates `snake_case` DB columns → `camelCase` TypeScript types. The backend always returns snake_case; the frontend always works in camelCase. When adding a new DB field, update both the `map*` function and the TypeScript interface in `src/portal/types/index.ts`.

### Display IDs vs UUIDs
All entities have both a UUID primary key (`id`) and a human-readable `displayId` (e.g., `EMP-0001`, `CLT-0001`, `TS-0001`, `INV-2026-0001`). Always use `UUID` for API calls and foreign keys; show `displayId` in the UI.

### Date handling
All dates must be computed in UTC to avoid timezone drift. Use the utilities in `backend/src/lib/dateUtils.ts` on the backend and `getMondayOfWeek()` / UTC-safe `Date.UTC()` patterns on the frontend. Never use `getDay()`, `setDate()`, or `new Date('YYYY-MM-DD')` without UTC anchoring.

### Timesheet state machine
Valid transitions only: `draft → submitted → manager_approved → client_approved`. Rejection can happen from `submitted` or `manager_approved` → `rejected`. The backend enforces this; do not allow arbitrary status patches.

### Portal CSS isolation
The portal is wrapped in `<div className="portal-scope">`. All portal-specific CSS must be under `.portal-scope` in `portal.css` to avoid bleeding into the public site's Bootstrap/template styles. Never apply Tailwind classes directly to elements that also carry Bootstrap classes.

### Responsive design (portal)
- Use Tailwind's `sm:` / `md:` / `lg:` prefixes throughout.
- `DataTable` supports `hideOnMobile: true` on columns — use it for secondary info columns.
- `TimesheetWeekGrid` has a dual-view: desktop horizontal table (`hidden md:block`) + mobile vertical card list (`md:hidden`).
- All dialogs use `w-[95vw] max-w-Nxl` pattern to prevent mobile overflow.

### CSS layering (public site)
When overriding template CSS, write overrides in `src/index.css` (loaded after `src/styles/style.css`). For rules that need to beat template specificity, target `src/styles/style.css` directly and add mobile breakpoint rules there (e.g., `.header-gutter.home` mobile overrides). The template uses Bootstrap `d-none d-xl-block` to hide the top bar below 1200px — also add `@media (max-width: 1199px) { .top-header { display: none !important; } }` as a safety fallback.
