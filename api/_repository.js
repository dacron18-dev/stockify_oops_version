// StockRepository: the ONLY place that talks to the database from the server.
// The Supabase client is a private field, so nothing else can use it (encapsulation).
import { createClient } from "@supabase/supabase-js";

export class StockRepository {
  #db;

  constructor(db) {
    this.#db = db;
  }

  // Factory: builds a repository with the secret server key
  static create(env = process.env) {
    return new StockRepository(
      createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    );
  }

  // who is this logged-in token? returns { id } or null
  async userFromToken(token) {
    const { data, error } = await this.#db.auth.getUser(token);
    return error || !data?.user ? null : { id: data.user.id };
  }

  async isAdmin(userId) {
    const { data } = await this.#db.from("profiles").select("role").eq("id", userId).single();
    return data?.role === "admin";
  }

  async priceSource() {
    const { data } = await this.#db.from("settings").select("price_source").eq("id", 1).single();
    return data?.price_source ?? "manual";
  }

  // Only one caller gets the slot per interval, so many open tabs do not all hit the provider
  async claimRefreshSlot(cutoffIso) {
    const { data } = await this.#db.from("settings")
      .update({ last_fetch: new Date().toISOString() })
      .eq("id", 1)
      .or(`last_fetch.is.null,last_fetch.lte.${cutoffIso}`)
      .select("id");
    return !!data && data.length > 0;
  }

  async touchRefresh() {
    await this.#db.from("settings").update({ last_fetch: new Date().toISOString() }).eq("id", 1);
  }

  async activeStocks() {
    const { data } = await this.#db.from("stocks").select("*").eq("active", true).not("api_symbol", "is", null);
    return data || [];
  }

  saveStock(symbol, patch) {
    return this.#db.from("stocks").update(patch).eq("symbol", symbol);
  }
}
