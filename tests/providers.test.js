import { test } from "node:test";
import assert from "node:assert/strict";
import { PriceProvider, YahooProvider, IndianApiProvider, FinnhubProvider, TwelveDataProvider, Quote } from "../api/_providers.js";

// ---- simulated network ----
let lastUrl, lastHeaders;
const reply = (status, body) => async (url, opts = {}) => { lastUrl = url; lastHeaders = opts.headers || {}; return { ok: status < 400, status, json: async () => body }; };
const yahooBody = { chart: { result: [{ meta: { regularMarketPrice: 2950.5, chartPreviousClose: 2930.25 } }] } };
const nse = (sym) => ({ symbol: sym, api_symbol: sym, api_exchange: "NSE" });

// ---------------- abstract base + factory ----------------
test("PriceProvider is abstract", () => {
  assert.throws(() => new PriceProvider(), /abstract/);
});

test("a subclass that forgets to override quote() fails loudly", async () => {
  class Lazy extends PriceProvider { get name() { return "lazy"; } }
  await assert.rejects(() => new Lazy().quote({}), /must implement quote/);
  class Nameless extends PriceProvider {}
  assert.throws(() => new Nameless().name, /must define get name/);
});

test("PriceProvider.create (factory) builds the right subclass", () => {
  assert.ok(PriceProvider.create("yahoo") instanceof YahooProvider);
  assert.ok(PriceProvider.create("IndianAPI") instanceof IndianApiProvider);
  assert.ok(PriceProvider.create("finnhub") instanceof FinnhubProvider);
  assert.ok(PriceProvider.create("twelvedata") instanceof TwelveDataProvider);
  assert.ok(PriceProvider.create("yahoo") instanceof PriceProvider);
  assert.throws(() => PriceProvider.create("bloomberg"), /Unknown PRICE_PROVIDER "bloomberg".*yahoo/);
  assert.deepEqual(PriceProvider.available.sort(), ["finnhub", "indianapi", "twelvedata", "yahoo"]);
});

test("polymorphism: every provider has its own name and refresh default", () => {
  const rows = ["yahoo", "indianapi", "finnhub", "twelvedata"].map((n) => {
    const p = PriceProvider.create(n);
    return [p.name, p.defaultRefreshSeconds];
  });
  assert.deepEqual(rows, [["yahoo", 60], ["indianapi", 3600], ["finnhub", 60], ["twelvedata", 300]]);
});

test("encapsulation: API keys are private and never leak", () => {
  const p = PriceProvider.create("indianapi", { INDIANAPI_KEY: "SECRET-KEY-123" });
  assert.deepEqual(Object.keys(p), []);
  assert.ok(!JSON.stringify(p).includes("SECRET-KEY-123"));
  assert.equal(p.apiKey, undefined);
  assert.equal(p.INDIANAPI_KEY, undefined);
});

// ---------------- Quote value object ----------------
test("Quote validates itself and is immutable", () => {
  assert.equal(new Quote({ price: 10 }).isValid, true);
  assert.equal(new Quote({ price: 0 }).isValid, false);
  assert.equal(new Quote({ price: "abc" }).isValid, false);
  const q = new Quote({ price: 10, prevClose: 9, label: "X" });
  assert.equal(q.prevClose, 9);
  assert.equal(new Quote({ price: 10, prevClose: -1 }).prevClose, null);
  assert.throws(() => { "use strict"; q.price = 99; }, TypeError);
});

// ---------------- Yahoo ----------------
test("Yahoo: symbol mapping", () => {
  const f = YahooProvider.symbolFor;
  assert.equal(f({ symbol: "RELIANCE", api_symbol: "RELIANCE", api_exchange: "NSE" }), "RELIANCE.NS");
  assert.equal(f({ symbol: "TCS", api_symbol: "tcs", api_exchange: "bse" }), "TCS.BO");
  assert.equal(f({ symbol: "X", api_symbol: "INFY.NS", api_exchange: "NSE" }), "INFY.NS");
  assert.equal(f({ symbol: "NIFTY", api_symbol: "^NSEI" }), "^NSEI");
  assert.equal(f({ symbol: "AAPL", api_symbol: "AAPL", api_exchange: null }), "AAPL");
  assert.equal(f({ symbol: "ITC", api_symbol: null, api_exchange: "NSE" }), "ITC.NS");
});

test("Yahoo: parses a quote and sends a browser User-Agent", async () => {
  globalThis.fetch = reply(200, yahooBody);
  const q = await new YahooProvider().quote(nse("RELIANCE"));
  assert.ok(q instanceof Quote);
  assert.equal(q.price, 2950.5);
  assert.equal(q.prevClose, 2930.25);
  assert.ok(lastUrl.includes("/v8/finance/chart/RELIANCE.NS"));
  assert.match(lastHeaders["User-Agent"], /Mozilla/);
});

test("Yahoo: previousClose is preferred, unknown symbol and zero price give null", async () => {
  globalThis.fetch = reply(200, { chart: { result: [{ meta: { regularMarketPrice: 100, previousClose: 98, chartPreviousClose: 90 } }] } });
  assert.equal((await new YahooProvider().quote(nse("A"))).prevClose, 98);
  globalThis.fetch = reply(200, { chart: { result: null, error: { code: "Not Found" } } });
  assert.equal(await new YahooProvider().quote(nse("ZZZ")), null);
  globalThis.fetch = reply(200, { chart: { result: [{ meta: { regularMarketPrice: 0 } }] } });
  assert.equal(await new YahooProvider().quote(nse("Z")), null);
});

test("Yahoo: errors are readable and special characters are encoded", async () => {
  globalThis.fetch = reply(429, {});
  await assert.rejects(() => new YahooProvider().quote(nse("A")), /HTTP 429 \(rate limit or quota used up\)/);
  globalThis.fetch = reply(200, yahooBody);
  await new YahooProvider().quote(nse("M&M"));
  assert.ok(lastUrl.includes("M%26M.NS"));
});

test("a request that never answers is aborted after the timeout", async () => {
  globalThis.fetch = (url, opts) => new Promise((_, rej) => opts.signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const t0 = Date.now();
  await assert.rejects(() => new YahooProvider({}, { timeoutMs: 60 }).quote(nse("A")), /aborted/);
  assert.ok(Date.now() - t0 < 1000);
});

// ---------------- IndianAPI ----------------
const ia = { symbol: "RELIANCE", name: "Reliance Industries", api_symbol: "Reliance", api_exchange: "NSE" };
const iaBody = { tickerId: "RELIANCE", companyName: "Reliance Industries Limited", currentPrice: { BSE: "2200.50", NSE: "2195.75" }, percentChange: "1.25" };
const iaProvider = () => new IndianApiProvider({ INDIANAPI_KEY: "KEY123" });

test("IndianAPI: price, previous close, label, URL and key header", async () => {
  globalThis.fetch = reply(200, iaBody);
  const q = await iaProvider().quote(ia);
  assert.equal(q.price, 2195.75);
  assert.equal(q.prevClose, Math.round((2195.75 / 1.0125) * 100) / 100);
  assert.equal(q.label, "Reliance Industries Limited");
  assert.equal(lastUrl, "https://stock.indianapi.in/stock?name=Reliance");
  assert.equal(lastHeaders["X-Api-Key"], "KEY123");
});

test("IndianAPI: BSE choice, NSE fallback, missing price", async () => {
  globalThis.fetch = reply(200, iaBody);
  assert.equal((await iaProvider().quote({ ...ia, api_exchange: "BSE" })).price, 2200.5);
  globalThis.fetch = reply(200, { companyName: "X", currentPrice: { BSE: 50 } });
  const q = await iaProvider().quote(ia);
  assert.equal(q.price, 50);
  assert.equal(q.prevClose, null);
  globalThis.fetch = reply(200, { companyName: "X" });
  assert.equal(await iaProvider().quote(ia), null);
});

test("IndianAPI: encodes the search term, falls back to the company name, reports a rejected key", async () => {
  globalThis.fetch = reply(200, iaBody);
  await iaProvider().quote({ ...ia, api_symbol: "Larsen & Toubro" });
  assert.ok(lastUrl.endsWith("name=Larsen%20%26%20Toubro"));
  await iaProvider().quote({ symbol: "TCS", name: "Tata Consultancy Services", api_symbol: null });
  assert.ok(lastUrl.endsWith("name=Tata%20Consultancy%20Services"));
  globalThis.fetch = reply(401, {});
  await assert.rejects(() => iaProvider().quote(ia), /API key rejected/);
  const custom = new IndianApiProvider({ INDIANAPI_KEY: "k", INDIANAPI_BASE_URL: "https://dev.example.com/" });
  globalThis.fetch = reply(200, iaBody);
  await custom.quote(ia);
  assert.ok(lastUrl.startsWith("https://dev.example.com/stock?name="));
});

// ---------------- Finnhub and Twelve Data ----------------
test("Finnhub: parses c and pc, uses the key", async () => {
  globalThis.fetch = reply(200, { c: 150.25, pc: 148 });
  const q = await new FinnhubProvider({ FINNHUB_API_KEY: "FK" }).quote({ symbol: "AAPL", api_symbol: "AAPL" });
  assert.equal(q.price, 150.25);
  assert.equal(q.prevClose, 148);
  assert.ok(lastUrl.includes("symbol=AAPL") && lastUrl.includes("token=FK"));
  globalThis.fetch = reply(200, { c: 0 });
  assert.equal(await new FinnhubProvider({}).quote({ api_symbol: "X" }), null);
});

test("Twelve Data: parses close, handles API errors", async () => {
  globalThis.fetch = reply(200, { close: "101.5", previous_close: "100" });
  const q = await new TwelveDataProvider({ TWELVEDATA_API_KEY: "TK" }).quote(nse("RELIANCE"));
  assert.equal(q.price, 101.5);
  assert.equal(q.prevClose, 100);
  assert.ok(lastUrl.includes("exchange=NSE") && lastUrl.includes("apikey=TK"));
  globalThis.fetch = reply(200, { status: "error", message: "bad symbol" });
  assert.equal(await new TwelveDataProvider({}).quote(nse("X")), null);
});
