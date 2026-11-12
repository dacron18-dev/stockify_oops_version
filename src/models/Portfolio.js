// Holding: shares of ONE stock.   Portfolio: cash + many Holdings (composition).
// "prices" below is a plain object like { RELIANCE: 2950.5, TCS: 4100 }.

export class Holding {
  #symbol;
  #qty;
  #avgPrice;

  constructor({ symbol, qty, avgPrice }) {
    this.#symbol = symbol;
    this.#qty = Number(qty);
    this.#avgPrice = Number(avgPrice);
  }
  static fromRow(r) { return new Holding({ symbol: r.symbol, qty: r.qty, avgPrice: r.avg_price }); }

  get symbol() { return this.#symbol; }
  get qty() { return this.#qty; }
  get avgPrice() { return this.#avgPrice; }
  get cost() { return this.#qty * this.#avgPrice; }

  valueAt(price) { return this.#qty * price; }
  pnlAt(price) { return this.valueAt(price) - this.cost; }
  pnlPctAt(price) { return this.cost ? (this.pnlAt(price) / this.cost) * 100 : 0; }
}

export class Portfolio {
  #cash;
  #holdings;
  #startCash;

  constructor({ cash, holdings = [], startCash = 0 }) {
    this.#cash = Number(cash);
    this.#holdings = [...holdings];
    this.#startCash = Number(startCash);
  }

  get cash() { return this.#cash; }
  get startCash() { return this.#startCash; }
  get holdings() { return [...this.#holdings]; } // a copy, so callers cannot change the portfolio

  qtyOf(symbol) { return this.#holdings.find((h) => h.symbol === symbol)?.qty || 0; }

  #priceOf(h, prices) { return prices[h.symbol] ?? h.avgPrice; } // falls back to the buy price

  holdingsValue(prices) { return this.#holdings.reduce((sum, h) => sum + h.valueAt(this.#priceOf(h, prices)), 0); }
  totalValue(prices) { return this.#cash + this.holdingsValue(prices); }
  overallPnl(prices) { return this.totalValue(prices) - this.#startCash; }
  returnPct(prices) { return this.#startCash ? (this.overallPnl(prices) / this.#startCash) * 100 : 0; }

  // one display row per holding
  rows(prices) {
    return this.#holdings.map((h) => {
      const price = this.#priceOf(h, prices);
      return {
        symbol: h.symbol, qty: h.qty, avgPrice: h.avgPrice, price,
        value: h.valueAt(price), pnl: h.pnlAt(price), pnlPct: h.pnlPctAt(price),
      };
    });
  }
}
