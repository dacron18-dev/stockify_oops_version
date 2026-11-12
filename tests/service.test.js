import { test } from "node:test";
import assert from "node:assert/strict";
import { PriceService } from "../api/_service.js";
import { PriceProvider, Quote } from "../api/_providers.js";

class FakeProvider extends PriceProvider {
  constructor(refresh = 60) { super(); this.calls = []; this.refresh = refresh; }
  get name() { return "fake"; }
  get defaultRefreshSeconds() { return this.refresh; }
  async quote(s) { this.calls.push(s.symbol); return new Quote({ price: 200, prevClose: 190 }); }
}

// A fake repository with the same methods as StockRepository (duck typing)
function fakeRepo({ users = {}, admins = [], source = "live", claim = true } = {}) {
  const log = { claimed: [], touched: 0, saved: [], userLookups: 0 };
  return {
    log,
    async userFromToken(t) { log.userLookups++; return users[t] ? { id: users[t] } : null; },
    async isAdmin(id) { return admins.includes(id); },
    async priceSource() { return source; },
    async claimRefreshSlot(cutoff) { log.claimed.push(cutoff); return claim; },
    async touchRefresh() { log.touched++; },
    async activeStocks() { return [{ symbol: "A", price: 100, prev_close: 100, api_symbol: "A" }, { symbol: "B", price: 100, prev_close: 100, api_symbol: "B" }]; },
    async saveStock(symbol, patch) { log.saved.push(symbol); return {}; },
  };
}
const svc = (repo, provider = new FakeProvider(), extra = {}) => new PriceService({ repository: repo, provider, now: () => Date.UTC(2026, 10, 12, 10, 0, 0), ...extra });

test("no token or an unknown token -> 401", async () => {
  const s = svc(fakeRepo({ users: { good: "u1" } }));
  assert.equal((await s.handle({ token: "", force: false })).status, 401);
  const r = await s.handle({ token: "bad", force: false });
  assert.deepEqual([r.status, r.body.error], [401, "Not logged in"]);
});

test("live mode off -> nothing is fetched", async () => {
  const provider = new FakeProvider();
  const r = await svc(fakeRepo({ users: { t: "u1" }, source: "manual" }), provider).handle({ token: "t" });
  assert.equal(r.body.skipped, "live mode is off");
  assert.equal(provider.calls.length, 0);
});

test("live mode on and the slot is free -> prices are refreshed", async () => {
  const repo = fakeRepo({ users: { t: "u1" } });
  const provider = new FakeProvider();
  const r = await svc(repo, provider).handle({ token: "t" });
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, "fake");
  assert.equal(r.body.updated, 2);
  assert.deepEqual(provider.calls.sort(), ["A", "B"]);
  assert.deepEqual(repo.log.saved.sort(), ["A", "B"]);
});

test("slot already taken -> 'prices are fresh', provider not called", async () => {
  const provider = new FakeProvider();
  const r = await svc(fakeRepo({ users: { t: "u1" }, claim: false }), provider).handle({ token: "t" });
  assert.equal(r.body.skipped, "prices are fresh");
  assert.equal(provider.calls.length, 0);
});

test("the throttle cutoff is 'now minus the refresh seconds'", async () => {
  const repo = fakeRepo({ users: { t: "u1" } });
  await svc(repo, new FakeProvider(90)).handle({ token: "t" });
  assert.equal(repo.log.claimed[0], new Date(Date.UTC(2026, 10, 12, 10, 0, 0) - 90 * 1000).toISOString());
  const repo2 = fakeRepo({ users: { t: "u1" } });
  await svc(repo2, new FakeProvider(90), { refreshSeconds: "30" }).handle({ token: "t" });
  assert.equal(repo2.log.claimed[0], new Date(Date.UTC(2026, 10, 12, 10, 0, 0) - 30 * 1000).toISOString());
});

test("refresh seconds default comes from the provider (polymorphism)", () => {
  assert.equal(svc(fakeRepo(), PriceProvider.create("indianapi")).refreshSeconds, 3600);
  assert.equal(svc(fakeRepo(), PriceProvider.create("yahoo")).refreshSeconds, 60);
  assert.equal(svc(fakeRepo(), PriceProvider.create("yahoo"), { refreshSeconds: "20" }).refreshSeconds, 20);
  assert.equal(svc(fakeRepo(), PriceProvider.create("yahoo"), { refreshSeconds: "abc" }).refreshSeconds, 60);
});

test("an ADMIN can force a refresh even when live mode is off and the slot is taken", async () => {
  const repo = fakeRepo({ users: { t: "boss" }, admins: ["boss"], source: "manual", claim: false });
  const provider = new FakeProvider();
  const r = await svc(repo, provider).handle({ token: "t", force: true });
  assert.equal(r.body.updated, 2);
  assert.equal(repo.log.touched, 1);
  assert.equal(repo.log.claimed.length, 0);
});

test("a normal user CANNOT force a refresh", async () => {
  const repo = fakeRepo({ users: { t: "student" }, admins: [], source: "manual" });
  const provider = new FakeProvider();
  const r = await svc(repo, provider).handle({ token: "t", force: true });
  assert.equal(r.body.skipped, "live mode is off");
  assert.equal(provider.calls.length, 0);
  assert.equal(repo.log.touched, 0);
});

test("the scheduler secret can force a refresh without a user lookup", async () => {
  const repo = fakeRepo({ source: "manual" });
  const r = await svc(repo, new FakeProvider(), { cronSecret: "S3CRET" }).handle({ token: "S3CRET", force: true });
  assert.equal(r.body.updated, 2);
  assert.equal(repo.log.userLookups, 0);
  const wrong = await svc(repo, new FakeProvider(), { cronSecret: "S3CRET" }).handle({ token: "nope", force: true });
  assert.equal(wrong.status, 401);
});

test("without CRON_SECRET set, an empty token is never treated as the scheduler", async () => {
  const r = await svc(fakeRepo(), new FakeProvider(), { cronSecret: "" }).handle({ token: "", force: true });
  assert.equal(r.status, 401);
});
