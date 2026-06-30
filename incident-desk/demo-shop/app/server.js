// orders-api — a tiny instrumented service whose DB connection pool size is read from a ConfigMap.
// Under load, a too-small pool causes acquire timeouts → real 5xx + latency + error logs + slow
// traces (the "incident"). Restoring the pool size (a config change) resolves it.
const express = require("express");
const { Pool } = require("pg");
const client = require("prom-client");

const POOL_MAX = parseInt(process.env.DB_POOL_MAX || "10", 10);
const PORT = parseInt(process.env.PORT || "8080", 10);
const BUILD = process.env.BUILD || "v1.0.0";
const CACHE_MB = parseInt(process.env.CACHE_MB || "0", 10); // in-memory cache size; if > container memory limit → OOMKilled

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, svc: "orders-api", build: BUILD, msg, ...extra }));

// Warm an in-memory cache (gated by CACHE_MB, default off). Too large vs the container memory
// limit → the kernel OOMKills the process → CrashLoopBackOff (the second, "bigger" fault).
let _cache;
if (CACHE_MB > 0) { log("info", "warming cache", { cache_mb: CACHE_MB }); _cache = Buffer.alloc(CACHE_MB * 1024 * 1024, 1); }

const pool = new Pool({
  host: process.env.PGHOST || "postgres",
  user: process.env.PGUSER || "shop",
  password: process.env.PGPASSWORD || "shop",
  database: process.env.PGDATABASE || "shop",
  max: POOL_MAX,
  connectionTimeoutMillis: 500, // wait up to 0.5s for a pooled connection, then error → 503. Under the
  // sustained backlog (40 workers vs pool 10) most requests exceed this → a clear, steady 503 rate.
});
pool.on("error", (e) => log("error", "pool error", { err: String(e) }));

// ── metrics ──
const reg = new client.Registry();
client.collectDefaultMetrics({ register: reg });
const httpDur = new client.Histogram({ name: "http_request_duration_seconds", help: "request duration", labelNames: ["route", "status"], buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5], registers: [reg] });
const httpTotal = new client.Counter({ name: "http_requests_total", help: "requests", labelNames: ["route", "status"], registers: [reg] });
const poolInUse = new client.Gauge({ name: "db_pool_in_use", help: "checked-out connections", registers: [reg] });
const poolMax = new client.Gauge({ name: "db_pool_max", help: "configured max pool size", registers: [reg] });
const poolWaiting = new client.Gauge({ name: "db_pool_waiting", help: "requests waiting for a connection", registers: [reg] });
const poolAcquireErr = new client.Counter({ name: "db_pool_acquire_errors_total", help: "pool acquire timeouts", registers: [reg] });
setInterval(() => {
  poolMax.set(POOL_MAX);
  poolInUse.set(pool.totalCount - pool.idleCount);
  poolWaiting.set(pool.waitingCount);
}, 2000);

const app = express();
app.get("/healthz", (_q, r) => r.json({ ok: true, build: BUILD, pool_max: POOL_MAX, cache_mb: CACHE_MB }));
app.get("/metrics", async (_q, r) => { r.set("Content-Type", reg.contentType); r.end(await reg.metrics()); });

app.get("/orders", async (_q, res) => {
  const end = httpDur.startTimer({ route: "/orders" });
  let c;
  try {
    c = await pool.connect();                       // ← blocks here when the pool is exhausted
    const { rows } = await c.query("SELECT id, total FROM orders ORDER BY id DESC LIMIT 5");
    await c.query("SELECT pg_sleep(0.3)");          // hold the connection ~300ms (real work)
    res.json({ ok: true, recent: rows, build: BUILD });
    httpDur.observe({ route: "/orders", status: 200 }, 0); httpTotal.inc({ route: "/orders", status: 200 }); end({ status: 200 });
  } catch (e) {
    poolAcquireErr.inc();
    log("error", "checkout failed acquiring db connection", { err: String(e && e.message || e), pool_in_use: pool.totalCount - pool.idleCount, pool_max: POOL_MAX, waiting: pool.waitingCount });
    res.status(503).json({ error: "db pool exhausted", detail: String(e && e.message || e) });
    httpTotal.inc({ route: "/orders", status: 503 }); end({ status: 503 });
  } finally { if (c) c.release(); }
});

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      const c = await pool.connect();
      await c.query("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, total NUMERIC)");
      const { rows } = await c.query("SELECT count(*)::int AS n FROM orders");
      if (rows[0].n === 0) for (let j = 0; j < 20; j++) await c.query("INSERT INTO orders (total) VALUES ($1)", [(Math.random() * 100).toFixed(2)]);
      c.release();
      log("info", "process started", { build: BUILD, db_pool_max: POOL_MAX });
      return;
    } catch (e) { log("warn", "waiting for postgres", { err: String(e && e.message || e) }); await new Promise((r) => setTimeout(r, 2000)); }
  }
  log("error", "could not connect to postgres after retries");
}
app.listen(PORT, () => { log("info", `orders-api listening on :${PORT}`); init(); });
