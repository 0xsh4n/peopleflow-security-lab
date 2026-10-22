// Vercel Serverless Function entry for the PeopleFlow API.
//
// This file is intentionally plain JavaScript so Vercel does not type-check it.
// It imports a self-contained bundle of the Express app that is produced during
// the Vercel build step by `artifacts/api-server/build-vercel.mjs` (invoked from
// the build command in vercel.json). The bundle is emitted OUTSIDE the `api/`
// directory so Vercel does not mistake it for another function.
//
// An Express app instance is itself a `(req, res)` handler, which is what the
// Vercel Node.js runtime invokes. All `/api/*` requests are routed here by the
// rewrites in vercel.json.
import app from "../artifacts/api-server/dist/vercel-app.mjs";

export default app;
