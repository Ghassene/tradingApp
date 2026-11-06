import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const ALLOWED_PAIRS = ["CHF-EUR", "EUR-TND", "CHF-TND"] as const;
export type ForexPair = (typeof ALLOWED_PAIRS)[number];

export const ALLOWED_CURRENCIES = ["CHF", "EUR", "TND"] as const;
export type CurrencyCode = (typeof ALLOWED_CURRENCIES)[number];

export const marketCandles = pgTable("market_candles", {
  id: serial("id").primaryKey(),
  pair: text("pair").notNull(), // CHF-EUR | EUR-TND | CHF-TND
  timeframe: text("timeframe").notNull().default("1H"), // 15M | 1H | 4H | 1D
  timestamp: timestamp("timestamp").notNull(),
  open: doublePrecision("open").notNull(),
  high: doublePrecision("high").notNull(),
  low: doublePrecision("low").notNull(),
  close: doublePrecision("close").notNull(),
  volume: integer("volume").notNull().default(1200),
});

export const rateSnapshots = pgTable("rate_snapshots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  baseCurrency: text("base_currency").notNull(), // CHF | EUR | TND
  amount: doublePrecision("amount").notNull(),
  chfEurRate: doublePrecision("chf_eur_rate").notNull(),
  eurTndRate: doublePrecision("eur_tnd_rate").notNull(),
  chfTndRate: doublePrecision("chf_tnd_rate").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MarketCandle = typeof marketCandles.$inferSelect;
export type RateSnapshot = typeof rateSnapshots.$inferSelect;
