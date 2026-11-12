// ============================================================================
// PRICE PROVIDERS  (OOP version)
//
//   PriceProvider            <- abstract base class (cannot be created directly)
//     |- YahooProvider        <- no key, unofficial
//     |- IndianApiProvider    <- indianapi.in, needs a key
//     |- FinnhubProvider      <- needs a key
//     |- TwelveDataProvider   <- needs a key
//
// Every subclass OVERRIDES quote(stock) (polymorphism). The code that calls it never
// needs to know which provider it is talking to.
// Files starting with "_" inside /api are NOT exposed as web routes by Vercel.
// ============================================================================

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---- Value object: one price reading. Immutable, validates itself. ----------
export class Quote {
  #price;
  #prevClose;
  #label;

  constructor({ price, prevClose = null, label = null }) {
    this.#price = Number(price);
    this.#prevClose = Number(prevClose) > 0 ? Number(prevClose) : null;
    this.#label = label || null;
    Object.freeze(this);
  }
  get price() { return this.#price; }
  get prevClose() { return this.#prevClose; }
  get label() { return this.#label; }
  get isValid() { return Number.isFinite(this.#price) && this.#price > 0; }
}

// ---- Abstract base class ------------------------------------------------------
export class PriceProvider {
  #timeoutMs; // private field: only code inside this class can read it

  constructor({ timeoutMs = 4000 } = {}) {
    if (new.target === PriceProvider) {
      throw new TypeError("PriceProvider is abstract. Use PriceProvider.create(name) or a subclass.");
    }
    this.#timeoutMs = timeoutMs;
  }

  // abstract members: every subclass must override them
  get name() { throw new Error(`${this.constructor.name} must define get name()`); }
  async quote(_stock) { throw new Error(`${this.constructor.name} must implement quote(stock)`); }

  // overridable default: how often (seconds) this provider may be called
  get defaultRefreshSeconds() { return 60; }

  // Factory method: builds the right subclass from a name such as "yahoo".
  static create(name, env = process.env, options = {}) {
    const Provider = REGISTRY[String(name).toLowerCase()];
    if (!Provider) {
      throw new Error(`Unknown PRICE_PROVIDER "${name}". Use one of: ${Object.keys(REGISTRY).join(", ")}`);
    }
    return new Provider(env, options);
  }
  static get available() { return Object.keys(REGISTRY); }

  // ---- protected helpers for subclasses (underscore = "for subclasses only") ----
  async _getJson(url, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#timeoutMs);
    try {
      const r = await fetch(url, { ...options, signal: ctrl.signal });
      if (!r.ok) {
        const hint = r.status === 429 ? " (rate limit or quota used up)" : r.status === 401 || r.status === 403 ? " (API key rejected)" : "";
        throw new Error(`HTTP ${r.status}${hint}`);
      }
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // returns a valid Quote, or null when the provider had no usable price
  _quote(price, prevClose = null, label = null) {
    const q = new Quote({ price, prevClose, label });
    return q.isValid ? q : null;
  }
}

// ---- Yahoo Finance (no API key) ------------------------------------------------
export class YahooProvider extends PriceProvider {
  constructor(_env = process.env, options = {}) { // same (env, options) shape as every other provider
    super(options);
  }
  get name() { return "yahoo"; }
  get defaultRefreshSeconds() { return 60; }

  // RELIANCE + NSE -> RELIANCE.NS    RELIANCE + BSE -> RELIANCE.BO
  // A symbol that already has a dot (TCS.NS) or starts with ^ (^NSEI) is used as it is.
  static symbolFor(stock) {
    const s = String(stock.api_symbol || stock.symbol).trim().toUpperCase();
    if (s.includes(".") || s.startsWith("^")) return s;
    const ex = String(stock.api_exchange || "").trim().toUpperCase();
    if (ex === "NSE") return s + ".NS";
    if (ex === "BSE" || ex === "BOM") return s + ".BO";
    return s; // no exchange given: treated as a US ticker
  }

  async quote(stock) {
    const sym = YahooProvider.symbolFor(stock);
    const j = await this._getJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
      { headers: { "User-Agent": UA, Accept: "application/json" } }
    );
    const meta = j?.chart?.result?.[0]?.meta;
    return this._quote(meta?.regularMarketPrice, meta?.previousClose ?? meta?.chartPreviousClose);
  }
}

// ---- IndianAPI.in (API key, Indian stocks) -------------------------------------
// GET /stock?name=Reliance with header X-Api-Key. One request per stock.
// "name" is a search term, so set each stock's "API symbol" to something that finds the right company.
export class IndianApiProvider extends PriceProvider {
  #apiKey; // private: never exposed outside this class
  #baseUrl;

  constructor(env = process.env, options = {}) {
    super(options);
    this.#apiKey = env.INDIANAPI_KEY || "";
    this.#baseUrl = (env.INDIANAPI_BASE_URL || "https://stock.indianapi.in").replace(/\/+$/, "");
  }
  get name() { return "indianapi"; }
  get defaultRefreshSeconds() { return 3600; } // free plan is only 500 requests a month

  async quote(stock) {
    const term = stock.api_symbol || stock.name;
    const j = await this._getJson(`${this.#baseUrl}/stock?name=${encodeURIComponent(term)}`, {
      headers: { "X-Api-Key": this.#apiKey, Accept: "application/json" },
    });
    const cp = j?.currentPrice || {};
    const wantBse = String(stock.api_exchange || "NSE").toUpperCase() === "BSE";
    const price = Number(wantBse ? cp.BSE ?? cp.NSE : cp.NSE ?? cp.BSE);
    // the API gives today's % change, so previous close = price / (1 + change%)
    const pc = Number(j?.percentChange);
    const prev = Number.isFinite(pc) && pc > -99 ? Math.round((price / (1 + pc / 100)) * 100) / 100 : null;
    return this._quote(price, prev, j?.companyName || j?.tickerId);
  }
}

// ---- Finnhub (API key) ----------------------------------------------------------
export class FinnhubProvider extends PriceProvider {
  #apiKey;

  constructor(env = process.env, options = {}) {
    super(options);
    this.#apiKey = env.FINNHUB_API_KEY || "";
  }
  get name() { return "finnhub"; }
  get defaultRefreshSeconds() { return 60; }

  async quote(stock) {
    const sym = stock.api_exchange ? `${stock.api_symbol}.${stock.api_exchange}` : stock.api_symbol;
    const j = await this._getJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${this.#apiKey}`);
    return this._quote(j?.c, j?.pc); // c = current price, pc = previous close
  }
}

// ---- Twelve Data (API key) -------------------------------------------------------
export class TwelveDataProvider extends PriceProvider {
  #apiKey;

  constructor(env = process.env, options = {}) {
    super(options);
    this.#apiKey = env.TWELVEDATA_API_KEY || "";
  }
  get name() { return "twelvedata"; }
  get defaultRefreshSeconds() { return 300; } // 8 calls a minute on the free plan

  async quote(stock) {
    const ex = stock.api_exchange ? `&exchange=${encodeURIComponent(stock.api_exchange)}` : "";
    const j = await this._getJson(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(stock.api_symbol)}${ex}&apikey=${this.#apiKey}`
    );
    if (!j || j.status === "error") return null;
    return this._quote(j.close, j.previous_close);
  }
}

// name -> class (used by PriceProvider.create)
const REGISTRY = {
  yahoo: YahooProvider,
  indianapi: IndianApiProvider,
  finnhub: FinnhubProvider,
  twelvedata: TwelveDataProvider,
};
