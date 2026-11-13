import "dotenv/config";
import { processDue } from "../server/blast";
import { runRetention } from "../server/privacy";

// Standalone worker: `npm run worker`. Polls the Postgres-backed blast queue.
let stopping = false;
let ticks = 0;

async function loop() {
  console.log("[worker] started, provider =", process.env.WA_PROVIDER ?? "mock");
  while (!stopping) {
    try {
      const r = await processDue();
      if (r.sent || r.failed || r.retried) console.log("[worker] tick", r);
      if (++ticks % 30 === 0) console.log("[worker] alive, ticks =", ticks);
      if (ticks % 1800 === 1) { const n = await runRetention(); if (n) console.log("[worker] retention anonymised guests:", n); }
    } catch (e) {
      console.error("[worker] error", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("[worker] stopped");
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; });
void loop();
