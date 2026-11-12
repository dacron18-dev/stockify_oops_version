// ORDER HIERARCHY
//   Order (abstract)
//     |- BuyOrder
//     |- SellOrder
// validate() is a TEMPLATE METHOD: the base class does the common checks, then calls checkAgainst(),
// which each subclass overrides with its own rule (polymorphism).
// The database function place_order still re-checks everything on the server.

const rupees = (n) => (n < 0 ? "-" : "") + "₹" + Math.abs(Number(n)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class Order {
  #symbol;
  #qty;

  constructor(symbol, qty) {
    if (new.target === Order) throw new TypeError("Order is abstract. Use Order.create(side, symbol, qty).");
    this.#symbol = symbol;
    this.#qty = qty;
  }

  get symbol() { return this.#symbol; }
  get qty() { return this.#qty; }

  // abstract members
  get side() { throw new Error(`${this.constructor.name} must define get side()`); }
  get pastTense() { throw new Error(`${this.constructor.name} must define get pastTense()`); }
  checkAgainst(_portfolio, _price) { throw new Error(`${this.constructor.name} must implement checkAgainst()`); }

  estimate(price) { return price * (Number(this.#qty) || 0); }

  // returns an error message, or null when the order looks fine
  validate({ portfolio, price }) {
    if (!this.#symbol) return "Pick a stock first";
    if (!Number.isInteger(this.#qty) || this.#qty < 1) return "Quantity must be a whole number, 1 or more";
    return this.checkAgainst(portfolio, price);
  }

  // arguments for the database function place_order
  toRpcArgs() { return { p_symbol: this.#symbol, p_side: this.side, p_qty: this.#qty }; }

  // Factory method
  static create(side, symbol, qty) {
    if (side === "BUY") return new BuyOrder(symbol, qty);
    if (side === "SELL") return new SellOrder(symbol, qty);
    throw new Error(`Unknown order side "${side}"`);
  }
}

export class BuyOrder extends Order {
  get side() { return "BUY"; }
  get pastTense() { return "Bought"; }
  checkAgainst(portfolio, price) {
    const cost = this.estimate(price);
    return portfolio.cash < cost ? `Not enough cash: need ${rupees(cost)}, you have ${rupees(portfolio.cash)}` : null;
  }
}

export class SellOrder extends Order {
  get side() { return "SELL"; }
  get pastTense() { return "Sold"; }
  checkAgainst(portfolio) {
    const held = portfolio.qtyOf(this.symbol);
    return held < this.qty ? `You hold only ${held} of ${this.symbol}` : null;
  }
}
