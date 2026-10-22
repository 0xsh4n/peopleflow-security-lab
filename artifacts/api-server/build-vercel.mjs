// Builds a self-contained ESM bundle of the Express app for the Vercel
// Serverless Function (see /api/index.mjs). Unlike build.mjs, the entry point
// is app.ts (which does NOT call app.listen), and its default export is
// preserved so the function can `import app from` the bundle.
//
// Everything is bundled into a single file so the Vercel function needs no
// node_modules at runtime. Only truly dynamic, transport-only dependencies are
// left external; they are never loaded in production, where the logger uses no
// pino transport.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { build as esbuild } from "esbuild";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.resolve(artifactDir, "dist/vercel-app.mjs");

await rm(outfile, { force: true });

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/app.ts")],
  platform: "node",
  target: "node22",
  bundle: true,
  format: "esm",
  outfile,
  logLevel: "info",
  // node: built-ins (including node:sqlite) are external automatically.
  // Transport-only deps are externalized because they are only reached when a
  // pino transport is configured, which never happens in production.
  external: ["*.node", "pino-pretty", "thread-stream"],
  sourcemap: false,
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,
  },
});

console.log("Built Vercel API bundle:", outfile);
