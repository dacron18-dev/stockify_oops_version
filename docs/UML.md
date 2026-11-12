# Stockify: UML class diagrams

These render automatically on GitHub. To get an image for your report, paste a diagram into https://mermaid.live and export PNG or SVG.

Legend: `<<abstract>>` = abstract class, `-` = private, `+` = public, `#` = protected (by convention),
`*` = abstract method, `$` = static. Arrows: `<|--` inheritance ("is a"), `*--` composition ("has a"), `..>` uses.

## 1. Price providers (server)

```mermaid
classDiagram
    class PriceProvider {
        <<abstract>>
        -timeoutMs
        +name* string
        +defaultRefreshSeconds number
        +quote(stock)* Quote
        +create(name, env, options)$ PriceProvider
        +available$ string[]
        #_getJson(url, options)
        #_quote(price, prevClose, label) Quote
    }
    class YahooProvider {
        +name string
        +defaultRefreshSeconds number
        +quote(stock) Quote
        +symbolFor(stock)$ string
    }
    class IndianApiProvider {
        -apiKey
        -baseUrl
        +name string
        +defaultRefreshSeconds number
        +quote(stock) Quote
    }
    class FinnhubProvider {
        -apiKey
        +name string
        +quote(stock) Quote
    }
    class TwelveDataProvider {
        -apiKey
        +name string
        +defaultRefreshSeconds number
        +quote(stock) Quote
    }
    class Quote {
        -price
        -prevClose
        -label
        +price number
        +prevClose number
        +label string
        +isValid boolean
    }
    PriceProvider <|-- YahooProvider
    PriceProvider <|-- IndianApiProvider
    PriceProvider <|-- FinnhubProvider
    PriceProvider <|-- TwelveDataProvider
    PriceProvider ..> Quote : creates
```

## 2. Refreshing prices (server): composition and dependency injection

```mermaid
classDiagram
    class PriceService {
        -repository
        -provider
        -refreshSeconds
        -cronSecret
        +handle(token, force) status and body
    }
    class PriceRefresher {
        -provider
        -repository
        -batch
        -budgetMs
        +run(stocks) summary
        -refreshOne(stock, out)
        +shuffle(arr, rnd)$ array
    }
    class StockRepository {
        -db
        +create(env)$ StockRepository
        +userFromToken(token)
        +isAdmin(userId)
        +priceSource()
        +claimRefreshSlot(cutoff)
        +touchRefresh()
        +activeStocks()
        +saveStock(symbol, patch)
    }
    class PriceProvider {
        <<abstract>>
        +quote(stock)* Quote
    }
    PriceService *-- StockRepository
    PriceService *-- PriceProvider
    PriceService ..> PriceRefresher : creates
    PriceRefresher o-- PriceProvider
    PriceRefresher o-- StockRepository
```

## 3. Users (client): Customer and Admin

```mermaid
classDiagram
    class User {
        <<abstract>>
        -id
        -name
        -email
        +id string
        +name string
        +email string
        +role* string
        +isAdmin boolean
        +displayName string
        +permissions()* string[]
        +tabs()* Tab[]
        +can(permission) boolean
        +fromRow(row)$ User
    }
    class Customer {
        +role string
        +permissions() string[]
        +tabs() Tab[]
    }
    class Admin {
        +role string
        +isAdmin boolean
        +displayName string
        +permissions() string[]
        +tabs() Tab[]
    }
    User <|-- Customer
    User <|-- Admin
```

## 4. Trading (client): orders, portfolio, stocks

```mermaid
classDiagram
    class Order {
        <<abstract>>
        -symbol
        -qty
        +side* string
        +pastTense* string
        +checkAgainst(portfolio, price)* string
        +estimate(price) number
        +validate(portfolio, price) string
        +toRpcArgs() object
        +create(side, symbol, qty)$ Order
    }
    class BuyOrder {
        +side string
        +pastTense string
        +checkAgainst(portfolio, price) string
    }
    class SellOrder {
        +side string
        +pastTense string
        +checkAgainst(portfolio, price) string
    }
    class Portfolio {
        -cash
        -holdings
        -startCash
        +qtyOf(symbol) number
        +holdingsValue(prices) number
        +totalValue(prices) number
        +overallPnl(prices) number
        +returnPct(prices) number
        +rows(prices) Row[]
    }
    class Holding {
        -symbol
        -qty
        -avgPrice
        +cost number
        +valueAt(price) number
        +pnlAt(price) number
        +pnlPctAt(price) number
        +fromRow(row)$ Holding
    }
    class Stock {
        -symbol
        -name
        -price
        -prevClose
        +changePct number
        +isUp boolean
        +matches(query) boolean
        +fromRow(row)$ Stock
    }
    class PriceSimulator {
        -volPct
        +nextPrice(price) number
        +clamp(v)$ number
    }
    Order <|-- BuyOrder
    Order <|-- SellOrder
    Order ..> Portfolio : checks against
    Portfolio *-- Holding : has many
```
