# Deploying PeopleFlow to Vercel (free Hobby plan)

This guide hosts the entire app on a single Vercel project, within the free
Hobby tier:

- The **React/Vite frontend** is built to static files and served from Vercel's
  CDN.
- The **Express API** runs as one Vercel Serverless Function, reachable at
  `/api/*` on the same domain, so the browser's same-origin cookies keep
  working with no extra configuration.

Three small files in this repository make that work:

- [`vercel.json`](vercel.json) — build command, static output directory, and
  the routing rewrites.
- [`artifacts/api-server/build-vercel.mjs`](artifacts/api-server/build-vercel.mjs)
  — runs during the build to bundle the Express app into one self-contained ESM
  file at `artifacts/api-server/dist/vercel-app.mjs`.
- [`api/index.mjs`](api/index.mjs) — the serverless entry. It is plain
  JavaScript (so Vercel does not type-check it) and simply re-exports the
  prebuilt bundle as the function handler.

> **Why a prebuilt bundle instead of importing the TypeScript source directly?**
> Vercel type-checks a TypeScript function entry under `nodenext` module
> resolution, which rejects the API source's extensionless relative imports
> (error `TS2834`). Bundling the app with the project's own esbuild (bundler
> resolution) sidesteps that, and a plain-JS entry is never type-checked.

## Read this first: in-memory state on serverless

The API keeps **all state in memory**: the SQLite database is `:memory:`, and
sessions, reset tokens, and the request log live in plain `Map`/array objects.
That has consequences on any serverless platform, including Vercel:

- **State is ephemeral.** A new function instance starts empty and re-seeds the
  database. Role changes, profile edits, password resets, and stored-bio content
  last only until that instance is recycled (a cold start, a redeploy, or
  scale-out).
- **Sessions can drop.** A login stores the user id in the instance's memory. If
  a later request is served by a different instance, the signed session cookie
  is still valid but that instance has no record of it, so the API responds
  `401` and the UI returns to the sign-in screen.

This is acceptable for a demo or a single-tester security assessment, because
the app is designed to reset on restart anyway. To reduce session drops:

- Keep **Fluid Compute enabled** (it is the default for new projects). It reuses
  a warm instance across requests, so a single tester usually keeps their
  session until the next cold start.
- Test with **one user at a time**. Concurrency forces Vercel to spin up extra
  instances, which do not share memory.

If you later need state that survives restarts or multiple instances, move the
store to a managed database (for example Vercel Postgres or any hosted SQLite),
which is outside the scope of this free, ephemeral deployment.

## Prerequisites

- A free [Vercel](https://vercel.com) account.
- This repository pushed to GitHub, GitLab, or Bitbucket (for Git-based
  deploys), or the [Vercel CLI](https://vercel.com/docs/cli) installed locally
  (`npm i -g vercel`).
- No external services, API keys, or secrets are required.

## Deploy from the Vercel dashboard

1. **Import the project.** In the Vercel dashboard choose **Add New → Project**
   and import this repository. Leave the **Root Directory** as the repository
   root (do not point it at a subfolder — the build needs the whole pnpm
   workspace).

2. **Framework preset:** choose **Other**. The settings below come from
   `vercel.json`, so you do not need to fill in the build fields by hand:
   - Build command: `BASE_PATH=/ PORT=3000 pnpm --filter @workspace/peopleflow-lab build && pnpm --filter @workspace/api-server exec node build-vercel.mjs`
   - Output directory: `artifacts/peopleflow-lab/dist/public`

   > The frontend's `vite.config.ts` requires `BASE_PATH` and `PORT` to be set
   > at build time, which is why the build command provides them inline. `/` and
   > `3000` are correct for Vercel; you do not need to change them.

3. **Set the Node.js version.** In **Project Settings → Build & Deployment →
   Node.js Version**, select **22.x**. The API uses Node's built-in
   `node:sqlite` module, which needs Node 22 or newer.

4. **Install command.** Vercel detects pnpm from `pnpm-lock.yaml` and runs
   `pnpm install` automatically. Leave the install command on its default.

5. **Deploy.** Click **Deploy**. When the build finishes, open the generated
   URL.

## Deploy with the Vercel CLI (alternative)

From the repository root:

```bash
vercel        # first run links/creates the project; accept the detected settings
vercel --prod # promote to a production deployment
```

Set the Node.js version to 22.x once in the project settings (step 3 above);
the CLI reuses it on later deploys.

## Verify the deployment

Replace `your-app` with your Vercel domain:

- Frontend loads: open `https://your-app.vercel.app/` and sign in with
  `alice@peopleflow.test` / `alice123`.
- API responds: `https://your-app.vercel.app/api/healthz` returns
  `{"status":"ok"}`.
- Client-side routing works: navigate to a deep link such as
  `https://your-app.vercel.app/employees` and refresh the page. It should load
  rather than 404, thanks to the SPA rewrite.

The Burp Suite reproduction steps in [`README.md`](README.md) work unchanged
against the deployed origin; point your proxy at
`https://your-app.vercel.app`.

## How the routing works

From [`vercel.json`](vercel.json):

- `"/api/(.*)" → "/api"` sends every API request to the serverless function.
  The function receives the original URL (for example `/api/login`), and the
  Express app matches it because it mounts its router at `/api`.
- `"/(.*)" → "/index.html"` is the single-page-app fallback. Vercel serves real
  static files (hashed JS/CSS under `/assets`) directly from the filesystem
  first, so only unmatched routes fall through to `index.html`.

Rewrites are evaluated top to bottom and the first match wins, so API requests
never reach the SPA fallback.

## Fits within the free Hobby limits

- **Static hosting and bandwidth:** the built frontend is a handful of static
  assets, far below the 100 GB/month included bandwidth.
- **Serverless function:** one small function with fast (single-digit
  millisecond) responses. It stays well within Hobby's included compute and the
  default execution-time limit.
- **No always-on server, cron jobs, databases, or paid add-ons** are used, so
  nothing in this deployment requires a paid plan.

## Troubleshooting

- **Build fails with "BASE_PATH environment variable is required" or the same
  for PORT.** The build command in `vercel.json` sets both inline. If you
  overrode the build command in the dashboard, restore it or add `BASE_PATH=/`
  and `PORT=3000` as Build-time Environment Variables.

- **Build fails with `TS2834`/`TS2835` (relative imports need file
  extensions), or `Property 'use' does not exist on type 'Express'`.** This
  happens if the function imports the TypeScript source directly. Use the
  prebuilt-bundle setup in this repo: the plain-JS `api/index.mjs` imports
  `artifacts/api-server/dist/vercel-app.mjs`, which the build command produces
  via `build-vercel.mjs`. Confirm the build command includes the
  `... && pnpm --filter @workspace/api-server exec node build-vercel.mjs` step.

- **Function error mentioning `node:sqlite` or an experimental flag.** Confirm
  the project's Node.js version is 22.x or newer. If the runtime still refuses
  the import, add an Environment Variable `NODE_OPTIONS` with the value
  `--experimental-sqlite` and redeploy.

- **Signing in then immediately getting logged out.** This is the in-memory
  session behaviour described above: a different instance served the follow-up
  request. Keep Fluid Compute enabled and test as a single user; it is expected
  that a cold start or redeploy clears sessions.

- **Deep-link refresh returns 404.** Confirm `vercel.json` is at the repository
  root and includes the `"/(.*)" → "/index.html"` rewrite, and that the output
  directory is `artifacts/peopleflow-lab/dist/public`.

- **Install fails on pnpm workspace settings.** Make sure Vercel is using pnpm
  (it reads `pnpm-lock.yaml`). The repository's `pnpm-workspace.yaml` sets a
  `minimumReleaseAge`; if an older pnpm rejects it, upgrade the project's pnpm
  by adding a `"packageManager": "pnpm@9.15.0"` (or newer) field to the root
  `package.json`.

## Reminder

The application intentionally contains the access-control, injection, and
configuration weaknesses documented in [`README.md`](README.md). Deploy it only
as a private assessment target. Do not put real personal data into it, and take
the deployment down when you are finished (**Project Settings → delete**, or
`vercel remove`).
