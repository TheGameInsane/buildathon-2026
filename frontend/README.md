# Drona Frontend

Web console for the Autonomous SDR Platform — campaigns, inbox, prompt studio, and
per-tenant settings for the multi-tenant SDR backend. See the repo root `CLAUDE.md`
and `docs/` for the overall system and API contract.

## Stack

- React 19 + TypeScript, built with Vite
- React Router for routing, TanStack Query for data fetching/caching
- Tailwind CSS v4, Radix UI primitives, shadcn-style components (`src/components/ui`)
- react-hook-form + zod for forms and validation
- Recharts for charts

## Getting started

```bash
npm install
npm run dev       # start the dev server (Vite)
```

Other scripts:

```bash
npm run build      # type-check (tsc -b) then production build to dist/
npm run preview    # preview the production build locally
npm run lint        # eslint
```

## Project layout

```
src/
  api/          fetch wrappers per resource (campaigns, inbox, prospects, ...)
  hooks/        TanStack Query hooks built on top of src/api
  components/   shared UI components; components/ui holds shadcn-style primitives
  pages/        route-level views (campaigns, inbox, prompt studio, settings, ...)
  mocks/        mock data used by the API layer until backend endpoints are wired up
  lib/          shared utilities (auth context, formatting, design tokens, etc.)
  types/        shared TypeScript domain/wizard types
  dev/          dev-only routes, e.g. /dev/components (component gallery)
```

Routing is defined in `src/App.tsx`. Authenticated routes are gated by `RequireAuth`,
which redirects to `/login` when no user is signed in.

## Notes

- The `src/api` layer currently reads from `src/mocks`; swap these out for real HTTP
  calls to the backend as endpoints land (see `docs/api_contract.md`).
- No company-specific names, facts, or prices belong in this codebase — tenant identity
  and content come from the backend at runtime.
