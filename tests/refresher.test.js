import { test } from "node:test";
import assert from "node:assert/strict";
import { PriceRefresher } from "../api/_refresh.js";
import { PriceProvider, Quote } from "../api/_providers.js";

const mk = (n) => Array.from({ length: n }, (_, i) => ({ symbol: "S" + i, price: 100, prev_close: 100, api_symbol: "S" + i }));

// A fake provider: it IS-A PriceProvider (inheritance), so the refresher accepts it (polymorphism)
class FakeProvider extends PriceProvider {
  constructor(fn) { super(); this.fn = fn; }
  get name() { return "fake"; }
  quote(stock) { return this.fn(stock); }
}
const q = (price, prevClose = 100, label = null) => new Quote({ price, prevClose, label });
const repo = (saved = [], fail = false) => ({ async saveStock(symbol, patch) { saved.push([symbol, patch]); return fail ? { error: { message: "db down" } } : {}; } });
const run = (stocks, fn, saved = [], extra = {}) =>
  new PriceRefresher({ provider: new FakeProvider(fn), repository: repo(saved, extra.fail), ...extra }).run(stocks);

test("shuffle keeps every item once, reorders, and leaves the input alone", () => {
  const base = Array.from({ length: 20 }, (_, i) => i);
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sh = PriceRefresher.shuffle(base, rnd);
  assert.deepEqual([...sh].sort((a, b) => a - b), base);
  assert.notDeepEqual(sh, base);
  assert.equal(base[0], 0);
});

test("56 changed stocks are all saved with price, prev_close and updated_at", async () => {
  const saved = [];
  const r = await run(mk(56), async () => q(150, 99), saved);
  assert.equal(r.updated, 56);
  assert.equal(saved.length, 56);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.errors, []);
  assert.equal(saved[0][1].price, 150);
  assert.equal(saved[0][1].prev_close, 99);
  assert.ok(saved[0][1].updated_at);
});

test("unchanged prices are NOT written", async () => {
  const saved = [];
  let r = await run(mk(30), async () => q(100, 100), saved);
  assert.deepEqual([r.unchanged, r.updated, saved.length], [30, 0, 0]);
  r = await run(mk(5), async () => q(100, null), saved);
  assert.deepEqual([r.unchanged, saved.length], [5, 0]);
  r = await run(mk(5), async () => q(100.5, null), saved);
  assert.equal(r.updated, 5);
  assert.ok(!("prev_close" in saved.at(-1)[1]));
});

test("one failing stock does not stop the others", async () => {
  const r = await run(mk(12), async (s) => {
    if (s.symbol === "S3") throw new Error("HTTP 429 (rate limit or quota used up)");
    if (s.symbol === "S4") return null;
    return q(120, 100);
  });
  assert.equal(r.updated, 10);
  assert.equal(r.errors.length, 2);
  assert.ok(r.errors.some((e) => e.startsWith("S3: HTTP 429")));
  assert.ok(r.errors.some((e) => e.startsWith("S4: no data")));
});

test("a database error is reported and not counted as updated", async () => {
  const r = await run(mk(3), async () => q(120, 100), [], { fail: true });
  assert.deepEqual([r.updated, r.errors.length], [0, 3]);
});

test("never more requests at the same time than the batch size", async () => {
  let inflight = 0, max = 0;
  await run(mk(56), async () => { inflight++; max = Math.max(max, inflight); await new Promise((r) => setTimeout(r, 5)); inflight--; return q(120, 100); }, [], { batch: 10 });
  assert.equal(max, 10);
});

test("time budget stops early and reports what is left for the next refresh", async () => {
  let t = 0, calls = 0;
  const r = await run(mk(56), async () => { calls++; t += 7000; return q(120, 100); }, [], { batch: 10, budgetMs: 6000, now: () => t });
  assert.equal(calls, 10);
  assert.equal(r.updated, 10);
  assert.equal(r.skipped, 46);
});

test("random order means every stock is still refreshed over time", async () => {
  const seen = new Set(); let s2 = 7; const rnd = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30; i++) {
    let t = 0;
    await run(mk(56), async (s) => { seen.add(s.symbol); t += 7000; return q(120, 100); }, [], { batch: 10, budgetMs: 6000, now: () => t, rnd });
  }
  assert.equal(seen.size, 56);
});

test("company match labels are collected", async () => {
  const r = await run(mk(2), async (s) => q(120, 100, "Company " + s.symbol));
  assert.equal(r.matches.length, 2);
  assert.ok(r.matches[0].includes(" = Company "));
});
