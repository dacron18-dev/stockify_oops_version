// Stock: one tradable company with its current price.
export class Stock {
  #symbol;
  #name;
  #price;
  #prevClose;
  #active;

  constructor({ symbol, name, price, prevClose, active = true }) {
    this.#symbol = symbol;
    this.#name = name;
    this.#price = Number(price);
    this.#prevClose = Number(prevClose);
    this.#active = !!active;
  }

  // Factory: builds a Stock from a database row
  static fromRow(r) {
    return new Stock({ symbol: r.symbol, name: r.name, price: r.price, prevClose: r.prev_close, active: r.active });
  }

  get symbol() { return this.#symbol; }
  get name() { return this.#name; }
  get price() { return this.#price; }
  get prevClose() { return this.#prevClose; }
  get active() { return this.#active; }

  // derived values (computed, never stored)
  get changePct() { return this.#prevClose ? ((this.#price - this.#prevClose) / this.#prevClose) * 100 : 0; }
  get isUp() { return this.changePct >= 0; }

  matches(query) {
    return `${this.#symbol} ${this.#name}`.toLowerCase().includes(String(query || "").toLowerCase());
  }
}
