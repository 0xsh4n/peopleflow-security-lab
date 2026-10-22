// Vercel Serverless Function entry for the PeopleFlow API.
//
// It reuses the Express application defined in
// `artifacts/api-server/src/app.ts` (which does NOT call `app.listen`), so the
// same routes that run locally also run on Vercel. All `/api/*` requests are
// routed to this function by the rewrites in `vercel.json`.
//
// An Express app instance is itself a `(req, res)` request handler, which is
// exactly what the Vercel Node.js runtime invokes.
import app from "../artifacts/api-server/src/app";

export default app;
