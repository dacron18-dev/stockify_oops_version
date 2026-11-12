# Stockify (OOP version)

A paper-trading app for learning the stock market with virtual money. React + Vite + Supabase, deployed on Vercel.
This version is organised around **classes**, for an Object-Oriented Programming project.

- **Customer**: signs up, gets virtual cash, buys and sells at the current price, sees portfolio, order history and a leaderboard.
- **Admin**: sets prices (manually, with the built-in simulator, or from a live price API), adds stocks, opens/closes the market, manages users.

## Read this first for your report or viva
- `docs/OOP_CONCEPTS.md`: every OOP concept used, with exact file and line numbers, design patterns, and a C++ comparison table.
- `docs/UML.md`: four UML class diagrams (render on GitHub; export PNG/SVG from https://mermaid.live).
- `npm test`: 53 automated tests that prove the classes behave correctly.

## Class overview
| Area | Classes | File |
|---|---|---|
| Price sources (server) | `PriceProvider` (abstract) -> `YahooProvider`, `IndianApiProvider`, `FinnhubProvider`, `TwelveDataProvider`; `Quote` | `api/_providers.js` |
| Refreshing prices (server) | `PriceRefresher`, `PriceService`, `StockRepository` | `api/_refresh.js`, `api/_service.js`, `api/_repository.js` |
| Users (client) | `User` (abstract) -> `Customer`, `Admin` | `src/models/User.js` |
| Trading (client) | `Order` (abstract) -> `BuyOrder`, `SellOrder`; `Portfolio`, `Holding`, `Stock`, `PriceSimulator` | `src/models/*.js` |

`api/update-prices.js` is a thin adapter; `src/App.jsx`, `Customer.jsx` and `Admin.jsx` are the React screens that use the classes.

## Setup (about 15 minutes)
1. **Supabase**: create a free project. SQL Editor -> New query -> paste all of `supabase/schema.sql` -> Run.
   Optional: run `supabase/more-stocks.sql` for 46 more NSE stocks (56 in total).
2. **Authentication -> Providers -> Email**: switch OFF "Confirm email" so students can sign up and log in straight away.
3. **Run locally** (optional): copy `.env.example` to `.env`, fill the `VITE_` lines, then `npm install && npm run dev`.
4. **Sign up** in the app with your own email, then make yourself admin (SQL Editor):
   `update profiles set role = 'admin' where email = 'YOUR-EMAIL';` and refresh.
5. **Deploy**: push to GitHub, import in Vercel, add the environment variables below, Deploy.
6. In the admin screen, set real prices (Market control tab) or press **Start simulator**.

### Vercel environment variables
Browser (safe to expose): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_PRICE_PING_SECONDS` (default 20).
Server only (never use the `VITE_` prefix): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PRICE_PROVIDER`
(`yahoo` default, `indianapi`, `finnhub`, `twelvedata`), the provider's key if it needs one (`INDIANAPI_KEY`, `FINNHUB_API_KEY`,
`TWELVEDATA_API_KEY`), optional `PRICE_REFRESH_SECONDS`, `PRICE_BATCH`, `CRON_SECRET`.

## Live prices
Admin -> Settings -> **Refresh prices now** fetches once and shows which company each stock matched. Set Price source to
**Live API** to refresh automatically while someone is logged in. `yahoo` needs no key but is unofficial and delayed;
`indianapi` is official but its free plan is only 500 requests a month, so use the button once or twice a day.

## How trading stays honest
Customers cannot edit cash, holdings, orders or prices. Every order goes through the database function `place_order`,
which reads the price on the server and re-checks cash and holdings. The classes in `src/models` give friendly early
messages in the browser; the database is the final judge.

## Keeping the database small
Chart history keeps at most one point per stock every 20 seconds. Run `select prune_price_history(7);` in the SQL editor
now and then to delete points older than 7 days.

## Project structure
```
api/          Vercel serverless function + server classes (files starting with _ are not web routes)
src/          React screens (App, Customer, Admin, lib) and src/models (the client classes)
supabase/     schema.sql (full setup) and more-stocks.sql
tests/        node:test unit tests, run with npm test
docs/         OOP_CONCEPTS.md and UML.md
```
