# PeopleFlow Security Lab

An intentionally vulnerable grey-box training app with synthetic HR and payroll data. Use only in a private lab; do not deploy publicly or enter real information.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/peopleflow-lab run dev` — run the PeopleFlow web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- No external service credentials are required.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React + Vite
- API: Express 5
- Lab data: in-memory SQLite via `node:sqlite`; fake documents use an in-memory Mongo-style fixture
- Legacy HTML exercise views: EJS
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/peopleflow-lab` — PeopleFlow React/Vite interface
- `artifacts/api-server/src/routes/peopleflow.ts` — training API, seeded records, and legacy EJS views
- `lib/api-spec/openapi.yaml` — API contract and generated client source
- `README.md` — setup and manual finding reproductions

## Architecture decisions

- State is in memory and resets on API restart or the lab reset endpoint.
- Unsafe import and diagnostic examples are simulations; no shell command or user-supplied code is executed.
- The document-search route models Mongo-style query operators without starting a MongoDB server.

## Product

PeopleFlow presents a fake HR workspace with employee records, payslips, profile editing, an admin role console, document search, configuration, diagnostic/import tools, and request logs. The README documents expected results for local training exercises.

## User preferences

- Keep the intentionally vulnerable exercises scoped to synthetic training data, and include reproduction steps in the README.

## Gotchas

- Do not publish this app or use real credentials/employee information.
- Node may print an experimental warning for the built-in SQLite module.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
