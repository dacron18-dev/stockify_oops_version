import { test } from "node:test";
import assert from "node:assert/strict";
import { User, Customer, Admin, Stock, Holding, Portfolio, Order, BuyOrder, SellOrder, PriceSimulator } from "../src/models/index.js";

// ---------------- User hierarchy ----------------
test("User is abstract and cannot be created directly", () => {
  assert.throws(() => new User({ id: 1, name: "x" }), /abstract/);
});

test("User.fromRow (factory) returns the right subclass", () => {
  const c = User.fromRow({ id: "1", name: "Asha", email: "a@x.com", role: "customer" });
  const a = User.fromRow({ id: "2", name: "Teacher", email: "t@x.com", role: "admin" });
  assert.ok(c instanceof Customer && c instanceof User);
  assert.ok(a instanceof Admin && a instanceof User);
  assert.equal(c.role, "customer");
  assert.equal(a.role, "admin");
});

test("polymorphism: same method names, different behaviour per subclass", () => {
  const c = User.fromRow({ id: "1", name: "Asha", role: "customer" });
  const a = User.fromRow({ id: "2", name: "Teacher", role: "admin" });
  assert.deepEqual(c.tabs().map((t) => t.key), ["market", "portfolio", "orders", "board"]);
  assert.deepEqual(a.tabs().map((t) => t.key), ["market", "users", "orders", "settings"]);
  assert.equal(c.can("trade"), true);
  assert.equal(c.can("manage_prices"), false);
  assert.equal(a.can("manage_prices"), true);
  assert.equal(a.can("trade"), false);
  assert.equal(c.isAdmin, false);
  assert.equal(a.isAdmin, true);
  assert.equal(c.displayName, "Asha");
  assert.equal(a.displayName, "Teacher (admin)");
});

test("encapsulation: user data is private, only getters are public", () => {
  const u = User.fromRow({ id: "1", name: "Asha", email: "a@x.com", role: "customer" });
  assert.deepEqual(Object.keys(u), []);               // no public fields
  assert.equal(u.name, "Asha");                        // readable through a getter
  assert.throws(() => { "use strict"; u.name = "Hacker"; }, TypeError); // getter only: cannot be assigned
  assert.equal(u.name, "Asha");
});

// ---------------- Stock ----------------
test("Stock derives change percent and direction", () => {
  const s = Stock.fromRow({ symbol: "TCS", name: "Tata Consultancy", price: "4141", prev_close: "4100", active: true });
  assert.ok(Math.abs(s.changePct - 1) < 1e-9);
  assert.equal(s.isUp, true);
  const d = new Stock({ symbol: "X", name: "X", price: 90, prevClose: 100 });
  assert.equal(d.changePct, -10);
  assert.equal(d.isUp, false);
  assert.equal(new Stock({ symbol: "Z", name: "Z", price: 5, prevClose: 0 }).changePct, 0);
});

test("Stock.matches searches symbol and name, ignoring case", () => {
  const s = new Stock({ symbol: "RELIANCE", name: "Reliance Industries", price: 1, prevClose: 1 });
  assert.ok(s.matches("indus") && s.matches("RELI") && s.matches(""));
  assert.ok(!s.matches("tata"));
});

// ---------------- Holding + Portfolio (composition) ----------------
const holdings = () => [
  new Holding({ symbol: "RELIANCE", qty: 10, avgPrice: 2900 }),
  new Holding({ symbol: "TCS", qty: 5, avgPrice: 4000 }),
];

test("Holding computes cost, value and profit", () => {
  const h = new Holding({ symbol: "A", qty: 10, avgPrice: 100 });
  assert.equal(h.cost, 1000);
  assert.equal(h.valueAt(120), 1200);
  assert.equal(h.pnlAt(120), 200);
  assert.equal(h.pnlPctAt(120), 20);
  assert.equal(h.pnlPctAt(80), -20);
});

test("Portfolio totals, profit and return", () => {
  const p = new Portfolio({ cash: 900000, holdings: holdings(), startCash: 1000000 });
  const prices = { RELIANCE: 3000, TCS: 4100 };
  assert.equal(p.holdingsValue(prices), 10 * 3000 + 5 * 4100);   // 50500
  assert.equal(p.totalValue(prices), 950500);
  assert.equal(p.overallPnl(prices), -49500);
  assert.ok(Math.abs(p.returnPct(prices) - -4.95) < 1e-9);
});

test("Portfolio falls back to the buy price when no market price is known", () => {
  const p = new Portfolio({ cash: 0, holdings: holdings(), startCash: 0 });
  assert.equal(p.holdingsValue({}), 10 * 2900 + 5 * 4000);
  assert.equal(p.returnPct({}), 0); // no start cash: no division by zero
});

test("Portfolio.rows gives one display row per holding", () => {
  const rows = new Portfolio({ cash: 0, holdings: holdings(), startCash: 0 }).rows({ RELIANCE: 3190 });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { symbol: "RELIANCE", qty: 10, avgPrice: 2900, price: 3190, value: 31900, pnl: 2900, pnlPct: 10 });
  assert.equal(rows[1].price, 4000);
});

test("encapsulation: a Portfolio cannot be changed from outside", () => {
  const p = new Portfolio({ cash: 100, holdings: holdings(), startCash: 100 });
  p.holdings.push(new Holding({ symbol: "HACK", qty: 999, avgPrice: 1 })); // changes only a copy
  assert.equal(p.holdings.length, 2);
  assert.equal(p.qtyOf("HACK"), 0);
  assert.equal(p.qtyOf("TCS"), 5);
  assert.deepEqual(Object.keys(p), []);
});

// ---------------- Order hierarchy ----------------
test("Order is abstract; Order.create (factory) builds BuyOrder or SellOrder", () => {
  assert.throws(() => new Order("TCS", 1), /abstract/);
  const b = Order.create("BUY", "TCS", 2);
  const s = Order.create("SELL", "TCS", 2);
  assert.ok(b instanceof BuyOrder && b instanceof Order);
  assert.ok(s instanceof SellOrder && s instanceof Order);
  assert.throws(() => Order.create("HOLD", "TCS", 1), /Unknown order side/);
});

test("polymorphism: side, wording and rules differ per subclass", () => {
  const b = Order.create("BUY", "TCS", 3);
  const s = Order.create("SELL", "TCS", 3);
  assert.equal(b.side, "BUY");
  assert.equal(s.side, "SELL");
  assert.equal(b.pastTense, "Bought");
  assert.equal(s.pastTense, "Sold");
  assert.deepEqual(b.toRpcArgs(), { p_symbol: "TCS", p_side: "BUY", p_qty: 3 });
  assert.equal(b.estimate(100), 300);
});

test("BuyOrder checks cash", () => {
  const rich = new Portfolio({ cash: 1000, holdings: [], startCash: 1000 });
  const poor = new Portfolio({ cash: 299, holdings: [], startCash: 1000 });
  assert.equal(Order.create("BUY", "TCS", 3).validate({ portfolio: rich, price: 100 }), null);
  assert.match(Order.create("BUY", "TCS", 3).validate({ portfolio: poor, price: 100 }), /Not enough cash/);
});

test("SellOrder checks holdings", () => {
  const p = new Portfolio({ cash: 0, holdings: [new Holding({ symbol: "TCS", qty: 5, avgPrice: 1 })], startCash: 0 });
  assert.equal(Order.create("SELL", "TCS", 5).validate({ portfolio: p, price: 1 }), null);
  assert.equal(Order.create("SELL", "TCS", 6).validate({ portfolio: p, price: 1 }), "You hold only 5 of TCS");
  assert.equal(Order.create("SELL", "INFY", 1).validate({ portfolio: p, price: 1 }), "You hold only 0 of INFY");
});

test("template method: common checks run before the subclass rule", () => {
  const p = new Portfolio({ cash: 1e9, holdings: [], startCash: 0 });
  assert.equal(Order.create("BUY", "", 1).validate({ portfolio: p, price: 1 }), "Pick a stock first");
  for (const q of [0, -2, 1.5, NaN]) {
    assert.match(Order.create("BUY", "TCS", q).validate({ portfolio: p, price: 1 }), /whole number/);
  }
});

// ---------------- PriceSimulator ----------------
test("PriceSimulator moves a price within the allowed range", () => {
  const up = new PriceSimulator({ volPct: 1, rnd: () => 1 });     // biggest rise
  const down = new PriceSimulator({ volPct: 1, rnd: () => 0 });   // biggest fall
  const flat = new PriceSimulator({ volPct: 1, rnd: () => 0.5 });
  assert.equal(up.nextPrice(100), 101);
  assert.equal(down.nextPrice(100), 99);
  assert.equal(flat.nextPrice(100), 100);
});

test("PriceSimulator never goes below 1 and clamps the volatility", () => {
  assert.equal(new PriceSimulator({ volPct: 10, rnd: () => 0 }).nextPrice(1), 1);
  assert.equal(new PriceSimulator({ volPct: 500 }).volPct, 10);
  assert.equal(new PriceSimulator({ volPct: 0.0001 }).volPct, 0.05);
  assert.equal(new PriceSimulator({ volPct: "abc" }).volPct, 0.5);
});
