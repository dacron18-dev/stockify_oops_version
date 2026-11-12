// PriceRefresher: fetches prices for a list of stocks through ANY PriceProvider and saves them.
// - stocks are fetched in a random order, in batches, with a time budget (a long list never times out)
// - a stock whose price did not change is not written (no useless database traffic or live-update messages)
// The provider and the repository are INJECTED (dependency injection), so tests can pass fakes.

export class PriceRefresher {
  #provider;
  #repository;
  #batch;
  #budgetMs;
  #now;
  #rnd;

  constructor({ provider, repository, batch = 10, budgetMs = 6000, now = Date.now, rnd = Math.random }) {
    this.#provider = provider;
    this.#repository = repository;
    this.#batch = batch;
    this.#budgetMs = budgetMs;
    this.#now = now;
    this.#rnd = rnd;
  }

  static shuffle(arr, rnd = Math.random) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async run(stocks) {
    const list = PriceRefresher.shuffle(stocks, this.#rnd);
    const started = this.#now();
    const out = { updated: 0, unchanged: 0, skipped: 0, errors: [], matches: [] };

    for (let i = 0; i < list.length; i += this.#batch) {
      if (this.#now() - started > this.#budgetMs) { out.skipped = list.length - i; break; } // done on the next refresh
      await Promise.all(list.slice(i, i + this.#batch).map((s) => this.#refreshOne(s, out)));
    }
    return out;
  }

  async #refreshOne(s, out) {
    try {
      const q = await this.#provider.quote(s); // polymorphic call: works for every provider
      if (!q || !q.isValid) { out.errors.push(`${s.symbol}: no data (check the API symbol and exchange)`); return; }
      if (q.label) out.matches.push(`${s.symbol} = ${q.label}`);
      const samePrice = Number(s.price) === q.price;
      const samePrev = !q.prevClose || Number(s.prev_close) === q.prevClose;
      if (samePrice && samePrev) { out.unchanged++; return; }
      const patch = { price: q.price, updated_at: new Date().toISOString() };
      if (q.prevClose) patch.prev_close = q.prevClose;
      const { error } = await this.#repository.saveStock(s.symbol, patch);
      if (error) out.errors.push(`${s.symbol}: ${error.message}`); else out.updated++;
    } catch (e) {
      out.errors.push(`${s.symbol}: ${e.message}`);
    }
  }
}
