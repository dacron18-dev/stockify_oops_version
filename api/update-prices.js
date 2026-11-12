// Vercel serverless function (thin adapter): turns the web request into a PriceService call.
//  - The app calls it every ~20s while someone is logged in and Price source = Live (throttled by the service).
//  - An admin can force a refresh with the "Refresh prices now" button (?force=1).
//  - An external scheduler can call it with  Authorization: Bearer <CRON_SECRET>.
//
// Server-only env vars (Vercel -> Settings -> Environment Variables, NO "VITE_" prefix):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   PRICE_PROVIDER = yahoo (default, no key) | indianapi | finnhub | twelvedata
//   INDIANAPI_KEY / FINNHUB_API_KEY / TWELVEDATA_API_KEY  (only for those providers)
//   PRICE_REFRESH_SECONDS (default depends on the provider), PRICE_BATCH (default 10), CRON_SECRET (optional)
import { PriceProvider } from "./_providers.js";
import { StockRepository } from "./_repository.js";
import { PriceService } from "./_service.js";

export default async function handler(req, res) {
  try {
    const service = new PriceService({
      repository: StockRepository.create(),
      provider: PriceProvider.create(process.env.PRICE_PROVIDER || "yahoo"),
      refreshSeconds: process.env.PRICE_REFRESH_SECONDS,
      cronSecret: process.env.CRON_SECRET,
      batch: Number(process.env.PRICE_BATCH || 10),
    });
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    const { status, body } = await service.handle({ token, force: req.query?.force === "1" });
    return res.status(status).json(body);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
