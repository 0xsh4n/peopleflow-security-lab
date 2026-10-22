---
name: In-process SQLite in Node 24
description: Replit workspace behavior and guidance for small, in-memory SQLite services.
---

Node 24 in this workspace provides `node:sqlite` with `DatabaseSync` for an in-process SQLite database. It works without a database service or native package install, though Node currently emits an experimental-feature warning.

**Why:** Native packages such as `better-sqlite3` may be installed with lifecycle build scripts ignored by the workspace. Do not bypass that safeguard just to use SQLite in a disposable training app.

**How to apply:** Prefer `node:sqlite` for synthetic, in-memory examples. For production data, choose a supported persistence approach and confirm the runtime's stability requirements before relying on this experimental API.
