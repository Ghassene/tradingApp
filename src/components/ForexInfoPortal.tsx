"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALLOWED_CURRENCIES,
  ALLOWED_PAIRS,
  CURRENCY_META,
  PAIR_SPECS,
  convertAllCurrencies,
  formatRate,
  type CurrencyCode,
  type ForexPair,
  type Timeframe,
} from "@/lib/forex";
import type { MarketPayload, RateSnapshotRecord } from "@/types/forex";
import { D3Sparkline } from "./D3Sparkline";
import { D3MainPriceChart } from "./D3MainPriceChart";
import { D3TriangularAnalytics } from "./D3TriangularAnalytics";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  Clock,
  Globe,
  Info,
  Landmark,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Scale,
  Trash2,
} from "lucide-react";

type InfoSection = "overview" | "matrix" | "central-banks";

export function ForexInfoPortal() {
  const [activeSection, setActiveSection] = useState<InfoSection>("overview");
  const [selectedPair, setSelectedPair] = useState<ForexPair>("CHF-EUR");
  const [timeframe, setTimeframe] = useState<Timeframe>("1H");
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [livePulse, setLivePulse] = useState(true);
  const [pulsingNow, setPulsingNow] = useState(false);

  // Simultaneous 3-Currency Converter State
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>("CHF");
  const [amountInput, setAmountInput] = useState("1000");
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Pinned Rate Snapshots (PostgreSQL)
  const [snapshots, setSnapshots] = useState<RateSnapshotRecord[]>([]);

  const fetchMarket = useCallback(
    async (pair: ForexPair, tf: Timeframe, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(
          `/api/market?pair=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(tf)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data: MarketPayload = await res.json();
          setMarket(data);
        }
      } catch (err) {
        console.error("Failed to load FX rates:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshots", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch rate snapshots:", err);
    }
  }, []);

  useEffect(() => {
    fetchMarket(selectedPair, timeframe, market !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPair, timeframe]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const pulseLiveRates = useCallback(async () => {
    setPulsingNow(true);
    try {
      const res = await fetch("/api/market/tick", { method: "POST" });
      if (res.ok) {
        await fetchMarket(selectedPair, timeframe, true);
      }
    } finally {
      setTimeout(() => setPulsingNow(false), 300);
    }
  }, [fetchMarket, selectedPair, timeframe]);

  const pulseRef = useRef(pulseLiveRates);
  pulseRef.current = pulseLiveRates;

  useEffect(() => {
    if (!livePulse) return;
    const interval = setInterval(() => {
      pulseRef.current();
    }, 5000);
    return () => clearInterval(interval);
  }, [livePulse]);

  const liveRates = useMemo(() => {
    return {
      chfEur:
        market?.tickers?.["CHF-EUR"]?.mid ?? PAIR_SPECS["CHF-EUR"].baselineMid,
      eurTnd:
        market?.tickers?.["EUR-TND"]?.mid ?? PAIR_SPECS["EUR-TND"].baselineMid,
      chfTnd:
        market?.tickers?.["CHF-TND"]?.mid ?? PAIR_SPECS["CHF-TND"].baselineMid,
    };
  }, [market]);

  const convertedAmounts = useMemo(() => {
    const numeric = Number(amountInput);
    return convertAllCurrencies(numeric, baseCurrency, liveRates);
  }, [amountInput, baseCurrency, liveRates]);

  async function handleSaveSnapshot(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number(amountInput);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;

    const label =
      snapshotLabel.trim() ||
      `${numericAmount.toLocaleString()} ${baseCurrency} Reference Fix`;

    setSavingSnapshot(true);
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          baseCurrency,
          amount: numericAmount,
          chfEurRate: liveRates.chfEur,
          eurTndRate: liveRates.eurTnd,
          chfTndRate: liveRates.chfTnd,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSnapshots((prev) => [data.snapshot, ...prev]);
        setSnapshotLabel("");
        setSavedNotice("Rate benchmark saved");
        setTimeout(() => setSavedNotice(null), 3000);
      }
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleDeleteSnapshot(id: number) {
    const prev = [...snapshots];
    setSnapshots((items) => items.filter((s) => s.id !== id));
    const res = await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setSnapshots(prev);
    }
  }

  const activeTicker = market?.tickers?.[selectedPair];
  const activeSpec = PAIR_SPECS[selectedPair];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Clean Editorial Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0B1120] flex items-center justify-center shadow-xs">
              <Globe className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm sm:text-base tracking-tight text-slate-950">
                  HELVETIA<span className="text-blue-700">//FX</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                  CHF · EUR · TND
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Foreign Exchange Information & D3.js Rate Intelligence
              </p>
            </div>
          </div>

          {/* Center View Navigation Pills */}
          <nav
            aria-label="Primary Information Sections"
            className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80"
          >
            <button
              type="button"
              onClick={() => setActiveSection("overview")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === "overview"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Live Rates & D3 Charts
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("matrix")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === "matrix"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Cross-Rate Matrix & Benchmarks
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("central-banks")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === "central-banks"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              SNB · ECB · BCT Briefs
            </button>
          </nav>

          {/* Right Live Feed Pulse Controls */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setLivePulse((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-white transition"
                title={livePulse ? "Pause live rate updates" : "Resume live rate updates"}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    livePulse ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                <span className="font-mono text-[11px]">
                  {livePulse ? "LIVE FEED" : "PAUSED"}
                </span>
                {livePulse ? (
                  <Pause className="w-3 h-3 text-slate-500" />
                ) : (
                  <Play className="w-3 h-3 text-slate-500" />
                )}
              </button>
              <button
                type="button"
                onClick={pulseLiveRates}
                className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-white transition"
                title="Refresh exchange rates now"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    pulsingNow ? "animate-spin text-blue-600" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Section Switcher */}
        <div className="md:hidden px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "overview", label: "Live Rates & D3" },
              { id: "matrix", label: "Matrix & Benchmarks" },
              { id: "central-banks", label: "SNB · ECB · BCT" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeSection === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Editorial Hero Banner */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono text-blue-700 font-semibold uppercase tracking-wider mb-1">
              <span>Dedicated Interbank Rate Monitor</span>
              <span>•</span>
              <span>3 Currency Pairs Only</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Swiss Franc, Euro & Tunisian Dinar Rates
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Real-time informational exchange rates, D3.js volatility &
              candlestick visualizations, and triangular cross-rate parity
              analytics for{" "}
              <strong className="font-mono text-slate-800">CHF-EUR</strong>,{" "}
              <strong className="font-mono text-slate-800">EUR-TND</strong>, and{" "}
              <strong className="font-mono text-slate-800">CHF-TND</strong>.
            </p>
          </div>

          {market?.updatedAt && (
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg self-start md:self-auto">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Updated{" "}
                {new Date(market.updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          )}
        </section>

        {/* 3 Exclusive FX Pair Showcase Cards */}
        <section aria-label="Exclusive Forex Pairs">
          {loading && !market ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-2xl bg-white border border-slate-200 p-5 animate-pulse space-y-3"
                >
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="h-8 w-36 bg-slate-200 rounded" />
                  <div className="h-10 w-full bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            market && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ALLOWED_PAIRS.map((p) => {
                  const t = market.tickers[p];
                  const isSelected = selectedPair === p;
                  const isPositive = t.changePct >= 0;
                  const rangeSpan = Math.max(0.0001, t.high24h - t.low24h);
                  const rangePct = Math.max(
                    4,
                    Math.min(96, ((t.mid - t.low24h) / rangeSpan) * 100)
                  );

                  return (
                    <div
                      key={p}
                      onClick={() => setSelectedPair(p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedPair(p);
                        }
                      }}
                      className={`rounded-2xl p-5 transition-all cursor-pointer border bg-white ${
                        isSelected
                          ? "border-blue-600 ring-2 ring-blue-600/15 shadow-md"
                          : "border-slate-200/90 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-slate-950">
                              {p}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {t.centralBanks}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {t.name}
                          </p>
                        </div>

                        <D3Sparkline
                          data={t.sparkline}
                          positive={isPositive}
                          idSuffix={p}
                        />
                      </div>

                      {/* Primary Mid Rate + 24h Change */}
                      <div className="mt-3 flex items-baseline justify-between">
                        <div className="font-mono text-2xl font-bold tracking-tight text-slate-950">
                          {t.mid.toFixed(4)}
                        </div>
                        <span
                          className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold px-2 py-0.5 rounded-md ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? "+" : ""}
                          {t.changePct.toFixed(2)}% ({isPositive ? "+" : ""}
                          {t.changePips}p)
                        </span>
                      </div>

                      {/* 24h Low–High Range Bar */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5">
                          <span>24H LOW: {t.low24h.toFixed(4)}</span>
                          <span>HIGH: {t.high24h.toFixed(4)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 relative overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-slate-300 via-blue-500 to-blue-700"
                            style={{ width: `${rangePct}%` }}
                          />
                        </div>
                      </div>

                      {/* Indicative Bid / Ask Reference */}
                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>Bid {t.bid.toFixed(4)}</span>
                        <span>Spread {t.spreadPips.toFixed(1)} pips</span>
                        <span>Ask {t.ask.toFixed(4)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </section>

        {/* SECTION 1: LIVE D3 ANALYTICS & SIMULTANEOUS 3-CURRENCY CONVERTER */}
        {activeSection === "overview" && market && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 8 Columns: D3 Main Chart */}
              <div className="xl:col-span-8 space-y-5">
                <D3MainPriceChart
                  pair={selectedPair}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  candles={market.candles}
                  parityHistory={market.triangularParity.history}
                  currentMid={activeTicker?.mid ?? activeSpec.baselineMid}
                />

                <D3TriangularAnalytics
                  activePair={selectedPair}
                  onSelectPair={setSelectedPair}
                  tickers={market.tickers}
                  triangularParity={market.triangularParity}
                />
              </div>

              {/* Right 4 Columns: Simultaneous 3-Currency Live Converter + Pair Brief */}
              <div className="xl:col-span-4 space-y-5">
                {/* Simultaneous CHF <-> EUR <-> TND Converter */}
                <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden">
                  <div className="px-5 py-4 bg-[#0B1120] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                      <div>
                        <h2 className="text-sm font-bold">
                          Live Currency Converter
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          Simultaneous CHF · EUR · TND conversion
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                      MID-MARKET
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Base Currency & Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Source Currency & Amount
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={baseCurrency}
                          onChange={(e) =>
                            setBaseCurrency(e.target.value as CurrencyCode)
                          }
                          className="px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          {ALLOWED_CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          placeholder="1000"
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      {/* Quick Presets */}
                      <div className="grid grid-cols-4 gap-1.5 mt-2">
                        {["100", "1000", "10000", "50000"].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAmountInput(val)}
                            className="py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-xs text-slate-700 transition"
                          >
                            {Number(val).toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Converted Currency Cards */}
                    <div className="space-y-2 pt-1">
                      {ALLOWED_CURRENCIES.map((code) => {
                        const meta = CURRENCY_META[code];
                        const value = convertedAmounts[code];
                        const isSource = code === baseCurrency;

                        return (
                          <div
                            key={code}
                            onClick={() => setBaseCurrency(code)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                setBaseCurrency(code);
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                              isSource
                                ? "bg-blue-50/70 border-blue-200"
                                : "bg-slate-50/80 border-slate-200/80 hover:border-slate-300"
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-slate-950">
                                  {code}
                                </span>
                                {isSource && (
                                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-600 text-white">
                                    Base
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">
                                {meta.name}
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <div className="text-base font-bold text-slate-950">
                                {value.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {meta.symbol}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pin Benchmark Snapshot Form (Persistent PostgreSQL) */}
                    <form
                      onSubmit={handleSaveSnapshot}
                      className="pt-3 border-t border-slate-100 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Pin Rate Benchmark
                        </label>
                        {savedNotice && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <Check className="w-3 h-3" /> {savedNotice}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={snapshotLabel}
                          onChange={(e) => setSnapshotLabel(e.target.value)}
                          placeholder="e.g., Zurich Invoice Reference"
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="submit"
                          disabled={savingSnapshot}
                          className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                        >
                          {savingSnapshot ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5" />
                          )}
                          <span>Save</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Selected Pair Institutional Context Card */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-700" />
                      <h3 className="text-sm font-bold text-slate-900">
                        {selectedPair} Market Profile
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-slate-500">
                      {activeSpec.centralBanks}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeSpec.summary}
                  </p>

                  <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Primary Fixing</span>
                      <span className="font-mono font-medium text-slate-900">
                        {activeSpec.fixingWindow}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Inverse Rate</span>
                      <span className="font-mono font-medium text-slate-900">
                        1 {activeSpec.quote} ={" "}
                        {(
                          1 / (activeTicker?.mid ?? activeSpec.baselineMid)
                        ).toFixed(4)}{" "}
                        {activeSpec.base}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Parity Alignment</span>
                      <span className="font-mono font-medium text-violet-700">
                        {market.triangularParity.alignmentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* SECTION 2: 3x3 CROSS-RATE MATRIX & PINNED BENCHMARKS */}
        {activeSection === "matrix" && market && (
          <div className="space-y-6">
            {/* 3x3 Complete Cross-Rate Matrix */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-950">
                      CHF · EUR · TND Cross-Rate Reference Matrix
                    </h2>
                    <p className="text-xs text-slate-500">
                      Direct & inverse mid-market conversion rates across all 3
                      currencies
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs text-slate-500">
                  1 UNIT BASE → QUOTE
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-mono uppercase text-slate-500">
                      <th className="py-3.5 px-6">Base Currency</th>
                      <th className="py-3.5 px-6">→ CHF (Swiss Franc)</th>
                      <th className="py-3.5 px-6">→ EUR (Euro)</th>
                      <th className="py-3.5 px-6">→ TND (Tunisian Dinar)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-sm">
                    <tr>
                      <td className="py-4 px-6 font-bold text-slate-950">
                        1 CHF
                      </td>
                      <td className="py-4 px-6 text-slate-400">1.0000</td>
                      <td className="py-4 px-6 font-semibold text-blue-700">
                        {liveRates.chfEur.toFixed(4)}
                      </td>
                      <td className="py-4 px-6 font-semibold text-violet-700">
                        {liveRates.chfTnd.toFixed(4)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 font-bold text-slate-950">
                        1 EUR
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-800">
                        {(1 / liveRates.chfEur).toFixed(4)}
                      </td>
                      <td className="py-4 px-6 text-slate-400">1.0000</td>
                      <td className="py-4 px-6 font-semibold text-emerald-700">
                        {liveRates.eurTnd.toFixed(4)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 font-bold text-slate-950">
                        1 TND
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-800">
                        {(1 / liveRates.chfTnd).toFixed(4)}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-800">
                        {(1 / liveRates.eurTnd).toFixed(4)}
                      </td>
                      <td className="py-4 px-6 text-slate-400">1.0000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pinned Rate Benchmarks (PostgreSQL Persistent Storage) */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-950">
                    Saved Rate Benchmarks ({snapshots.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Compare historical pinned FX fixings against live CHF-EUR,
                    EUR-TND, and CHF-TND rates
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("overview")}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  + Pin New Benchmark in Converter →
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No rate benchmarks saved yet. Use the Live Currency Converter
                  to pin a reference rate snapshot.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-5">Benchmark Label</th>
                        <th className="py-3 px-5">Reference Amount</th>
                        <th className="py-3 px-5">CHF-EUR</th>
                        <th className="py-3 px-5">EUR-TND</th>
                        <th className="py-3 px-5">CHF-TND</th>
                        <th className="py-3 px-5 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {snapshots.map((snap) => (
                        <tr key={snap.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-slate-900">
                              {snap.label}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {new Date(snap.createdAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-mono font-semibold text-slate-800">
                            {snap.amount.toLocaleString()} {snap.baseCurrency}
                          </td>
                          <td className="py-3.5 px-5 font-mono">
                            {formatRate("CHF-EUR", snap.chfEurRate)}
                          </td>
                          <td className="py-3.5 px-5 font-mono">
                            {formatRate("EUR-TND", snap.eurTndRate)}
                          </td>
                          <td className="py-3.5 px-5 font-mono">
                            {formatRate("CHF-TND", snap.chfTndRate)}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(snap.id)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition"
                              title="Remove benchmark"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: CENTRAL BANK & MONETARY BRIEFINGS (SNB · ECB · BCT) */}
        {activeSection === "central-banks" && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ALLOWED_CURRENCIES.map((code) => {
              const meta = CURRENCY_META[code];
              return (
                <div
                  key={code}
                  className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 font-mono text-base font-bold text-slate-950">
                        <Landmark className="w-4 h-4 text-blue-700" />
                        {meta.code} · {meta.symbol}
                      </span>
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white">
                        Policy Rate {meta.policyRate}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {meta.centralBank}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {meta.name} · {meta.jurisdiction}
                      </p>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                      {meta.fixingNote}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 font-mono text-xs space-y-1.5">
                    {code === "CHF" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">CHF-EUR Spot</span>
                          <span className="font-bold text-slate-900">
                            {liveRates.chfEur.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">CHF-TND Spot</span>
                          <span className="font-bold text-slate-900">
                            {liveRates.chfTnd.toFixed(4)}
                          </span>
                        </div>
                      </>
                    )}
                    {code === "EUR" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">EUR-TND Spot</span>
                          <span className="font-bold text-slate-900">
                            {liveRates.eurTnd.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">EUR-CHF Inverse</span>
                          <span className="font-bold text-slate-900">
                            {(1 / liveRates.chfEur).toFixed(4)}
                          </span>
                        </div>
                      </>
                    )}
                    {code === "TND" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">EUR-TND Fixing</span>
                          <span className="font-bold text-slate-900">
                            {liveRates.eurTnd.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">CHF-TND Fixing</span>
                          <span className="font-bold text-slate-900">
                            {liveRates.chfTnd.toFixed(4)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* Clean Informational Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="font-mono">
            HELVETIA//FX — Informational Foreign Exchange Monitor (CHF-EUR ·
            EUR-TND · CHF-TND)
          </div>
          <div>
            Powered by D3.js v7 SVG Analytics & PostgreSQL · Indicative Market
            Reference Only
          </div>
        </div>
      </footer>
    </div>
  );
}
