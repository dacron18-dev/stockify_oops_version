# OOP concepts in Stockify

This document is generated from the code, so every file and line number below is exact.
Run `npm test` to see the tests that prove each concept works (53 tests).

## At a glance

| | Count |
|---|---|
| Classes | **19** |
| Inheritance relationships (`extends`) | **8** |
| Abstract classes | **3**: `PriceProvider` (api/_providers.js:41), `Order` (src/models/Order.js:16), `User` (src/models/User.js:13) |
| Private fields (`#name`) | **39** |
| Private methods (`#name()`) | **2** |
| Constructors | **15** |
| `super(...)` calls | **4** |
| Static methods | **10** |
| Getters (read-only properties) | **48** |

## The four pillars

### 1. Encapsulation: data hidden inside the class
Fields are private with `#`, so code outside the class cannot read or change them. Outside code only gets read-only getters.

| Where | What is hidden |
|---|---|
| `src/models/User.js:8` `User` | `#id`, `#name`, `#email`. Read through getters `id`, `name`, `email` (lines 19-21); assigning to them throws |
| `src/models/Portfolio.js:28` `Portfolio` | `#cash`, `#holdings`, `#startCash`. The `holdings` getter returns a copy (`src/models/Portfolio.js:39`) so callers cannot change the portfolio |
| `api/_providers.js:121` `IndianApiProvider` | `#apiKey`: the secret key can never be read or printed from outside |
| `api/_repository.js:6` `StockRepository` | `#db`: the database client is only usable through the repository's methods |
| `api/_providers.js:38` `PriceProvider` | `#timeoutMs` |
| `api/_refresh.js:44` `PriceRefresher` | a private method `#refreshOne` |
| `src/models/Portfolio.js:43` `Portfolio` | a private method `#priceOf` |
| `api/_providers.js:28` `Quote` | `Object.freeze(this)`: the object is immutable after creation |

Tests: "encapsulation: user data is private", "encapsulation: a Portfolio cannot be changed from outside", "encapsulation: API keys are private and never leak".

### 2. Abstraction: callers use a simple interface, details stay hidden
- `api/_providers.js:37` `PriceProvider` is an **abstract class**. It declares `quote(stock)` (`api/_providers.js:49`) and `name` (`api/_providers.js:48`) but does not implement them. `new PriceProvider()` throws (`api/_providers.js:41`).
- `src/models/User.js:7` `User` is abstract: `role`, `permissions()` and `tabs()` must be overridden (`src/models/User.js:24`).
- `src/models/Order.js:11` `Order` is abstract: `side`, `pastTense` and `checkAgainst()` must be overridden (`src/models/Order.js:27`).
- The caller of a provider just writes `provider.quote(stock)` (`api/_refresh.js:46`) and never sees HTTP, URLs or JSON details.

Tests: "PriceProvider is abstract", "a subclass that forgets to override quote() fails loudly", "User is abstract...", "Order is abstract...".

### 3. Inheritance: a subclass reuses and extends a base class
8 `extends` relationships:

| Subclass | Base class | Where |
|---|---|---|
| `YahooProvider` | `PriceProvider` | `api/_providers.js:88` |
| `IndianApiProvider` | `PriceProvider` | `api/_providers.js:120` |
| `FinnhubProvider` | `PriceProvider` | `api/_providers.js:148` |
| `TwelveDataProvider` | `PriceProvider` | `api/_providers.js:166` |
| `BuyOrder` | `Order` | `src/models/Order.js:49` |
| `SellOrder` | `Order` | `src/models/Order.js:58` |
| `Customer` | `User` | `src/models/User.js:39` |
| `Admin` | `User` | `src/models/User.js:52` |

Shared code lives in the base class and is reused: for example `_getJson()` (`api/_providers.js:65`) and `_quote()` (`api/_providers.js:81`) are written once in `PriceProvider` and used by all four providers. Subclasses call `super(...)` to run the base constructor (`api/_providers.js:90`).

### 4. Polymorphism: same call, different behaviour depending on the object

**Method overriding** (each subclass replaces the base method):

| Method | Overridden in |
|---|---|
| `quote(stock)` | `api/_providers.js:106` Yahoo, `api/_providers.js:132` IndianAPI, `api/_providers.js:158` Finnhub, `api/_providers.js:176` Twelve Data |
| `defaultRefreshSeconds` | Yahoo (60), IndianAPI (3600), Twelve Data (300), base default (60): from `api/_providers.js:52` |
| `tabs()`, `permissions()`, `role` | `Customer` (`src/models/User.js:39`) and `Admin` (`src/models/User.js:52`) |
| `isAdmin`, `displayName` | `Admin` overrides the base values (`src/models/User.js:54`, `src/models/User.js:55`) |
| `side`, `pastTense`, `checkAgainst()` | `BuyOrder` (`src/models/Order.js:49`) and `SellOrder` (`src/models/Order.js:58`) |

**Runtime polymorphism** (the right version runs without any `if`):
- `api/_refresh.js:46` `PriceRefresher` calls `quote()` on whatever provider it was given.
- `src/Customer.jsx` and `src/Admin.jsx` build the tab bar from `user.tabs()`; a `Customer` and an `Admin` return different tabs.
- `src/Customer.jsx` calls `order.validate(...)`; a `BuyOrder` checks cash, a `SellOrder` checks holdings.

Tests: "polymorphism: same method names, different behaviour per subclass", "polymorphism: every provider has its own name and refresh default", "polymorphism: side, wording and rules differ per subclass".

## More OOP concepts used

| Concept | Where |
|---|---|
| **Constructors** with validation | 15 constructors, for example `api/_providers.js:24` `Quote`, `src/models/Order.js:15` `Order` |
| **Constructor chaining** (`super(...)`) | 4 calls, for example `api/_providers.js:125` |
| **Static methods** | 10 in total, for example `api/_providers.js:97` `YahooProvider.symbolFor`, `src/models/PriceSimulator.js:11` `PriceSimulator.clamp` |
| **Getters** (computed read-only properties) | 48 in total, for example `src/models/Stock.js:29` `Stock.changePct`, `src/models/Portfolio.js:19` `Holding.cost` |
| **Composition** ("has a") | `Portfolio` has many `Holding`s (`src/models/Portfolio.js:26`); `PriceService` has a repository and a provider (`api/_service.js:6`) |
| **Dependency injection** | `PriceService` and `PriceRefresher` receive their provider and repository as constructor arguments (`api/_service.js:14`, `api/_refresh.js:14`); the tests inject fake ones |
| **Immutability / value object** | `Quote` is frozen (`api/_providers.js:28`) |
| **`instanceof` / type checks** | tests check `c instanceof Customer && c instanceof User` |

## Design patterns used

| Pattern | Where |
|---|---|
| **Factory Method** | `PriceProvider.create(name)` (`api/_providers.js:55`), `User.fromRow(row)` (`src/models/User.js:33`), `Order.create(side, ...)` (`src/models/Order.js:42`), `Stock.fromRow`, `Holding.fromRow` |
| **Strategy** | the four providers are interchangeable strategies chosen at runtime by name |
| **Template Method** | `Order.validate()` (`src/models/Order.js:32`) runs the common checks, then calls the overridable step `checkAgainst()` |
| **Repository** | `StockRepository` (`api/_repository.js:5`) is the only class that touches the database |
| **Value Object** | `Quote` |

## How this maps to C++ (for your viva)

| JavaScript in Stockify | C++ equivalent |
|---|---|
| `#field` | `private:` data member |
| getter `get price()` | `double getPrice() const` |
| abstract class (`new.target` check, methods that throw) | class with a pure virtual function `virtual Quote quote(Stock) = 0;` |
| `class Yahoo extends PriceProvider` | `class Yahoo : public PriceProvider` |
| overriding `quote()` | `Quote quote(Stock) override;` |
| `super(options)` | base constructor in the initializer list `: PriceProvider(options)` |
| `static create()` | `static` factory function |
| `instanceof` | `dynamic_cast` |
| garbage collection | destructors (`~Class()`) are needed in C++ |

## Honest limits (what is not used)
- No **multiple inheritance** and no **method or operator overloading** (JavaScript does not support them).
- No `interface` keyword in JavaScript, so contracts are enforced with abstract methods that throw (and by duck typing in the tests).
- JavaScript has no real `protected`. Helpers meant for subclasses start with an underscore (`_getJson`, `_quote`) by convention.
- The database rules (the SQL functions such as `place_order`) are not OOP. They are the server-side safety net behind these classes.
