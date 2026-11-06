import type { CurrencyCode, ForexPair, Timeframe } from "@/lib/forex";

export interface MarketTicker {
  pair: ForexPair;
  name: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  centralBanks: string;
  fixingWindow: string;
  summary: string;
  accentHex: string;
  bid: number;
  ask: number;
  mid: number;
  spreadPips: number;
  high24h: number;
  low24h: number;
  changePct: number;
  changePips: number;
  sparkline: number[];
}

export interface CandlePoint {
  id: number;
  pair: ForexPair;
  timeframe: Timeframe;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ParityHistoryPoint {
  timestamp: string;
  actual: number;
  implied: number;
  basisPips: number;
}

export interface TriangularParityData {
  impliedChfTnd: number;
  actualChfTnd: number;
  basisPips: number;
  alignmentStatus: string;
  history: ParityHistoryPoint[];
}

export interface MarketPayload {
  pair: ForexPair;
  timeframe: Timeframe;
  updatedAt: string;
  tickers: Record<ForexPair, MarketTicker>;
  candles: CandlePoint[];
  triangularParity: TriangularParityData;
}

export interface RateSnapshotRecord {
  id: number;
  label: string;
  baseCurrency: CurrencyCode;
  amount: number;
  chfEurRate: number;
  eurTndRate: number;
  chfTndRate: number;
  createdAt: string;
}
