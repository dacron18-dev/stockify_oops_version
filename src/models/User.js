// USER HIERARCHY
//   User (abstract)
//     |- Customer   a learner who trades with virtual money
//     |- Admin      manages prices, users and settings
// Each subclass overrides role / permissions() / tabs() (polymorphism).

export class User {
  #id;
  #name;
  #email;

  constructor({ id, name, email = "" }) {
    if (new.target === User) throw new TypeError("User is abstract. Use User.fromRow(row).");
    this.#id = id;
    this.#name = name;
    this.#email = email;
  }

  get id() { return this.#id; }
  get name() { return this.#name; }
  get email() { return this.#email; }

  // abstract members
  get role() { throw new Error(`${this.constructor.name} must define get role()`); }
  permissions() { throw new Error(`${this.constructor.name} must implement permissions()`); }
  tabs() { throw new Error(`${this.constructor.name} must implement tabs()`); }

  get isAdmin() { return false; }
  get displayName() { return this.#name; }
  can(permission) { return this.permissions().includes(permission); }

  // Factory method: picks the right subclass from a database row
  static fromRow(row) {
    const data = { id: row.id, name: row.name, email: row.email || "" };
    return row.role === "admin" ? new Admin(data) : new Customer(data);
  }
}

export class Customer extends User {
  get role() { return "customer"; }
  permissions() { return ["trade", "view_portfolio", "view_leaderboard"]; }
  tabs() {
    return [
      { key: "market", label: "Market" },
      { key: "portfolio", label: "Portfolio" },
      { key: "orders", label: "Orders" },
      { key: "board", label: "Leaderboard" },
    ];
  }
}

export class Admin extends User {
  get role() { return "admin"; }
  get isAdmin() { return true; }                       // overrides the base value
  get displayName() { return `${this.name} (admin)`; } // overrides the base value
  permissions() { return ["manage_prices", "manage_users", "manage_settings", "view_all_orders"]; }
  tabs() {
    return [
      { key: "market", label: "Market control" },
      { key: "users", label: "Users" },
      { key: "orders", label: "All orders" },
      { key: "settings", label: "Settings" },
    ];
  }
}
