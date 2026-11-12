-- Stockify: 46 more NSE stocks (56 in total with the first 10).
-- Paste into Supabase -> SQL Editor -> New query -> Run. Safe to re-run (existing stocks are not touched).
--
-- The price 100 is only a placeholder. Real prices arrive when you press
-- Admin -> Settings -> "Refresh prices now" (press it again if it says some were left for the next refresh).
-- Tip: set the market to Closed in Settings first, then open it after the first refresh.
-- Tickers are NSE symbols as I know them; if one shows "no data" after a refresh, fix its API symbol in
-- Admin -> Market control, or untick Active to hide it.

insert into stocks (symbol, name, price, prev_close, api_symbol, api_exchange) values
  ('ADANIENT', 'Adani Enterprises', 100, 100, 'ADANIENT', 'NSE'),
  ('ADANIPORTS', 'Adani Ports & SEZ', 100, 100, 'ADANIPORTS', 'NSE'),
  ('ADANIPOWER', 'Adani Power', 100, 100, 'ADANIPOWER', 'NSE'),
  ('APOLLOHOSP', 'Apollo Hospitals', 100, 100, 'APOLLOHOSP', 'NSE'),
  ('ASIANPAINT', 'Asian Paints', 100, 100, 'ASIANPAINT', 'NSE'),
  ('AXISBANK', 'Axis Bank', 100, 100, 'AXISBANK', 'NSE'),
  ('BAJAJ-AUTO', 'Bajaj Auto', 100, 100, 'BAJAJ-AUTO', 'NSE'),
  ('BAJFINANCE', 'Bajaj Finance', 100, 100, 'BAJFINANCE', 'NSE'),
  ('BAJAJFINSV', 'Bajaj Finserv', 100, 100, 'BAJAJFINSV', 'NSE'),
  ('BEL', 'Bharat Electronics', 100, 100, 'BEL', 'NSE'),
  ('CIPLA', 'Cipla', 100, 100, 'CIPLA', 'NSE'),
  ('COALINDIA', 'Coal India', 100, 100, 'COALINDIA', 'NSE'),
  ('DRREDDY', 'Dr. Reddy''s Laboratories', 100, 100, 'DRREDDY', 'NSE'),
  ('EICHERMOT', 'Eicher Motors', 100, 100, 'EICHERMOT', 'NSE'),
  ('ETERNAL', 'Eternal (Zomato)', 100, 100, 'ETERNAL', 'NSE'),
  ('GRASIM', 'Grasim Industries', 100, 100, 'GRASIM', 'NSE'),
  ('HCLTECH', 'HCL Technologies', 100, 100, 'HCLTECH', 'NSE'),
  ('HDFCLIFE', 'HDFC Life Insurance', 100, 100, 'HDFCLIFE', 'NSE'),
  ('HEROMOTOCO', 'Hero MotoCorp', 100, 100, 'HEROMOTOCO', 'NSE'),
  ('HINDALCO', 'Hindalco Industries', 100, 100, 'HINDALCO', 'NSE'),
  ('HINDUNILVR', 'Hindustan Unilever', 100, 100, 'HINDUNILVR', 'NSE'),
  ('INDUSINDBK', 'IndusInd Bank', 100, 100, 'INDUSINDBK', 'NSE'),
  ('JSWSTEEL', 'JSW Steel', 100, 100, 'JSWSTEEL', 'NSE'),
  ('KOTAKBANK', 'Kotak Mahindra Bank', 100, 100, 'KOTAKBANK', 'NSE'),
  ('M&M', 'Mahindra & Mahindra', 100, 100, 'M&M', 'NSE'),
  ('MARUTI', 'Maruti Suzuki', 100, 100, 'MARUTI', 'NSE'),
  ('NESTLEIND', 'Nestle India', 100, 100, 'NESTLEIND', 'NSE'),
  ('NTPC', 'NTPC', 100, 100, 'NTPC', 'NSE'),
  ('ONGC', 'Oil & Natural Gas Corporation', 100, 100, 'ONGC', 'NSE'),
  ('POWERGRID', 'Power Grid Corporation', 100, 100, 'POWERGRID', 'NSE'),
  ('SBILIFE', 'SBI Life Insurance', 100, 100, 'SBILIFE', 'NSE'),
  ('SHRIRAMFIN', 'Shriram Finance', 100, 100, 'SHRIRAMFIN', 'NSE'),
  ('SUNPHARMA', 'Sun Pharmaceutical', 100, 100, 'SUNPHARMA', 'NSE'),
  ('TATACONSUM', 'Tata Consumer Products', 100, 100, 'TATACONSUM', 'NSE'),
  ('TMPV', 'Tata Motors Passenger Vehicles', 100, 100, 'TMPV', 'NSE'),
  ('TATASTEEL', 'Tata Steel', 100, 100, 'TATASTEEL', 'NSE'),
  ('TECHM', 'Tech Mahindra', 100, 100, 'TECHM', 'NSE'),
  ('TITAN', 'Titan Company', 100, 100, 'TITAN', 'NSE'),
  ('TRENT', 'Trent', 100, 100, 'TRENT', 'NSE'),
  ('ULTRACEMCO', 'UltraTech Cement', 100, 100, 'ULTRACEMCO', 'NSE'),
  ('JIOFIN', 'Jio Financial Services', 100, 100, 'JIOFIN', 'NSE'),
  ('SUZLON', 'Suzlon Energy', 100, 100, 'SUZLON', 'NSE'),
  ('NYKAA', 'Nykaa (FSN E-Commerce)', 100, 100, 'NYKAA', 'NSE'),
  ('OLAELEC', 'Ola Electric Mobility', 100, 100, 'OLAELEC', 'NSE'),
  ('IRCTC', 'IRCTC', 100, 100, 'IRCTC', 'NSE'),
  ('VEDL', 'Vedanta', 100, 100, 'VEDL', 'NSE')
on conflict (symbol) do nothing;
