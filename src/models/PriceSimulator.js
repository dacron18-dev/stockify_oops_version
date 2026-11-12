// PriceSimulator: produces the next random price for the demo simulator in the admin screen.
export class PriceSimulator {
  #volPct;
  #rnd;

  constructor({ volPct = 0.5, rnd = Math.random } = {}) {
    this.#volPct = PriceSimulator.clamp(volPct);
    this.#rnd = rnd;
  }

  static clamp(v) { return Math.min(10, Math.max(0.05, Number(v) || 0.5)); } // keeps the move between 0.05% and 10%

  get volPct() { return this.#volPct; }

  nextPrice(price) {
    const drift = (this.#rnd() - 0.5) * 2 * (this.#volPct / 100);
    return Math.max(1, Math.round(Number(price) * (1 + drift) * 100) / 100);
  }
}
