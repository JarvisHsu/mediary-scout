#!/usr/bin/env node
// Live-verify the full chain on real 115 + real Postgres: a fake/non-existent
// magnet (115 shows name == infohash) → executor detects it → RealStorageV2
// records a SOFT dead-link with the long (90-day) TTL, not the default 7d and not
// permanent. Proves the executor signal → recorder → Postgres expires_at path.
// TEST ROOT only; cleans up its task, dir, and dead_links row.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadDotEnv(p) { let raw; try { raw = readFileSync(p, "utf8"); } catch { return; }
  for (const line of raw.split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; } }
loadDotEnv(path.join(repoRoot, ".env"));

const { createProtectedPan115CookieStorageExecutorFromEnv, Pan115CookieClient, createPostgresWorkflowRepositorySync, CandidateRegistry, RealStorageV2, deadLinkKey } =
  await import(path.join(repoRoot, "packages/workflow/dist/index.js"));
const testRoot = process.env.MEDIA_TRACK_115_TEST_ROOT_CID;
const POSTGRES = process.env.MEDIA_TRACK_POSTGRES_URL || "postgresql://mediatrack:mediatrack@localhost:5432/media_track";
const executor = createProtectedPan115CookieStorageExecutorFromEnv({ env: process.env });
const client = new Pan115CookieClient({ cookie: process.env.PAN115_COOKIE });
const repo = createPostgresWorkflowRepositorySync({ connectionString: POSTGRES });

const fakeUrl = "magnet:?xt=urn:btih:abcdefabcdefabcdefabcdefabcdefabcdefabcd";
const key = deadLinkKey(fakeUrl).key;
const registry = new CandidateRegistry();
const storage = new RealStorageV2({ executor, registry, workflowRunId: "unresolved-live", deadLinkStore: repo });
registry.record({ id: "fake", snapshotId: "s", index: 0, title: "fake", type: "magnet", source: "pansou", episodeHints: [], qualityHints: [], providerPayload: { url: fakeUrl } });

let pass = false, stagingDir = null;
try {
  stagingDir = await executor.createDirectory({ name: `unresolved-live-${Date.now()}`, parentId: testRoot });
  const res = await storage.transferCandidate({ candidateId: "fake", intoDirectoryId: stagingDir });
  console.log(`transfer → status=${res.status}`);
  const { Client } = await import("pg");
  const c = new Client(POSTGRES); await c.connect();
  const row = (await c.query("select kind, permanent, reason, recorded_at, expires_at from dead_links where key=$1", [key])).rows[0];
  await c.end();
  if (!row) { console.log("❌ no dead_links row recorded"); }
  else {
    const days = row.expires_at ? (new Date(row.expires_at).getTime() - new Date(row.recorded_at).getTime()) / 86400000 : null;
    console.log(`dead_links row: kind=${row.kind} permanent=${row.permanent} expires_in≈${days?.toFixed(0)}d reason=${JSON.stringify(row.reason)}`);
    // expect: magnet, not permanent, ~90 day TTL (the long unresolved TTL)
    pass = row.kind === "magnet" && row.permanent === false && days !== null && days > 60;
    console.log(pass ? "✅ recorded as SOFT with the long (~90d) TTL — fake magnet skipped long, but will resurrect" : "❌ unexpected TTL/permanence");
  }
} finally {
  const { Client } = await import("pg");
  const c = new Client(POSTGRES); await c.connect();
  const r = await c.query("delete from dead_links where key=$1", [key]); console.log(`cleanup: removed ${r.rowCount} dead_links row`); await c.end();
  try { await client.removeOfflineTask({ infoHashes: [deadLinkKey(fakeUrl).key.split(":")[1]] }); } catch {}
  if (stagingDir) { try { await executor.removeDirectory(stagingDir); console.log("removed staging dir"); } catch {} }
}
process.exit(pass ? 0 : 1);
