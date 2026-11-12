// PriceService: the rules for "who may refresh prices, and when".
// It COMPOSES a repository (database) and a provider (price source); both are injected.

import { PriceRefresher } from "./_refresh.js";

export class PriceService {
  #repository;
  #provider;
  #refreshSeconds;
  #cronSecret;
  #batch;
  #now;

  constructor({ repository, provider, refreshSeconds, cronSecret = "", batch = 10, now = Date.now }) {
    this.#repository = repository;
    this.#provider = provider;
    // each provider knows its own sensible default (polymorphic getter)
    this.#refreshSeconds = Number(refreshSeconds) > 0 ? Number(refreshSeconds) : provider.defaultRefreshSeconds;
    this.#cronSecret = cronSecret;
    this.#batch = batch;
    this.#now = now;
  }

  get refreshSeconds() { return this.#refreshSeconds; }

  // returns { status, body } and never throws for expected situations
  async handle({ token, force = false }) {
    const isCron = !!this.#cronSecret && token === this.#cronSecret;
    let isAdmin = false;
    if (!isCron) {
      const user = await this.#repository.userFromToken(token);
      if (!user) return { status: 401, body: { error: "Not logged in" } };
      isAdmin = await this.#repository.isAdmin(user.id);
    }
    const forced = force && (isCron || isAdmin); // only admins or the scheduler may force a refresh

    if (!forced) {
      if ((await this.#repository.priceSource()) !== "live") return { status: 200, body: { skipped: "live mode is off" } };
      const cutoff = new Date(this.#now() - this.#refreshSeconds * 1000).toISOString();
      if (!(await this.#repository.claimRefreshSlot(cutoff))) return { status: 200, body: { skipped: "prices are fresh" } };
    } else {
      await this.#repository.touchRefresh();
    }

    const stocks = await this.#repository.activeStocks();
    const refresher = new PriceRefresher({ provider: this.#provider, repository: this.#repository, batch: this.#batch });
    const out = await refresher.run(stocks);
    return { status: 200, body: { provider: this.#provider.name, ...out } };
  }
}
