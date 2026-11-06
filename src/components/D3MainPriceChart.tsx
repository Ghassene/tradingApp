"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { ForexPair, Timeframe } from "@/lib/forex";
import { PAIR_SPECS, TIMEFRAMES, formatRate } from "@/lib/forex";
import type { CandlePoint, ParityHistoryPoint } from "@/types/forex";
import {
  Activity,
  CandlestickChart,
  GitCompareArrows,
  TrendingUp,
} from "lucide-react";

export type ChartVisualStyle = "AREA" | "CANDLES" | "PARITY";

interface D3MainPriceChartProps {
  pair: ForexPair;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  candles: CandlePoint[];
  parityHistory: ParityHistoryPoint[];
  currentMid: number;
}

function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeBollinger(values: number[], period = 16, mult = 2) {
  return values.map((_, idx) => {
    const start = Math.max(0, idx - period + 1);
    const slice = values.slice(start, idx + 1);
    const mean = d3.mean(slice) ?? values[idx];
    const variance =
      d3.mean(slice.map((v) => Math.pow(v - mean, 2))) ?? 0;
    const std = Math.sqrt(variance);
    return {
      mid: mean,
      upper: mean + mult * std,
      lower: mean - mult * std,
    };
  });
}

export function D3MainPriceChart({
  pair,
  timeframe,
  onTimeframeChange,
  candles,
  parityHistory,
  currentMid,
}: D3MainPriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 840, height: 420 });
  const [chartStyle, setChartStyle] = useState<ChartVisualStyle>("AREA");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoverPriceY, setHoverPriceY] = useState<number | null>(null);

  const spec = PAIR_SPECS[pair];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setDimensions({
          width: Math.max(320, Math.floor(rect.width)),
          height: rect.width < 640 ? 330 : 420,
        });
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleCandles = useMemo(() => candles.slice(-56), [candles]);

  const indicators = useMemo(() => {
    const closes = visibleCandles.map((c) => c.close);
    return {
      ema9: computeEMA(closes, 9),
      ema21: computeEMA(closes, 21),
      bollinger: computeBollinger(closes, 16, 2),
    };
  }, [visibleCandles]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 20, right: 76, bottom: 28, left: 16 };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = Math.max(140, height - margin.top - margin.bottom);

    const defs = svg.append("defs");

    const areaGrad = defs
      .append("linearGradient")
      .attr("id", "d3-fx-area-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    areaGrad
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#38BDF8")
      .attr("stop-opacity", 0.36);
    areaGrad
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#38BDF8")
      .attr("stop-opacity", 0.01);

    const bbGrad = defs
      .append("linearGradient")
      .attr("id", "d3-fx-bb-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    bbGrad
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#818CF8")
      .attr("stop-opacity", 0.14);
    bbGrad
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#818CF8")
      .attr("stop-opacity", 0.03);

    const rootG = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // TRIANGULAR CROSS-RATE PARITY MODE
    if (chartStyle === "PARITY") {
      if (parityHistory.length < 2) return;

      const priceAreaH = innerHeight * 0.68;
      const basisTop = priceAreaH + 18;
      const basisH = innerHeight - basisTop;

      const xScale = d3
        .scaleBand<number>()
        .domain(d3.range(parityHistory.length))
        .range([0, innerWidth])
        .padding(0.24);

      const allRates = parityHistory.flatMap((d) => [d.actual, d.implied]);
      const minR = d3.min(allRates) ?? 3.55;
      const maxR = d3.max(allRates) ?? 3.61;
      const padR = (maxR - minR || 0.005) * 0.16;

      const yRate = d3
        .scaleLinear()
        .domain([minR - padR, maxR + padR])
        .range([priceAreaH, 0]);

      const maxAbsBasis = Math.max(
        15,
        d3.max(parityHistory, (d) => Math.abs(d.basisPips)) ?? 15
      );
      const yBasis = d3
        .scaleLinear()
        .domain([-maxAbsBasis * 1.15, maxAbsBasis * 1.15])
        .range([basisTop + basisH, basisTop]);

      const yTicks = yRate.ticks(5);
      rootG
        .append("g")
        .selectAll("line")
        .data(yTicks)
        .join("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", (d) => yRate(d))
        .attr("y2", (d) => yRate(d))
        .attr("stroke", "#1E293B")
        .attr("stroke-dasharray", "3,3");

      const yAxis = d3
        .axisRight(yRate)
        .ticks(5)
        .tickFormat((d) => Number(d).toFixed(4));
      const yAxisG = rootG
        .append("g")
        .attr("transform", `translate(${innerWidth},0)`)
        .call(yAxis);
      yAxisG.selectAll("path, line").attr("stroke", "#334155");
      yAxisG
        .selectAll("text")
        .attr("fill", "#94A3B8")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", "10.5px");

      const actualLine = d3
        .line<ParityHistoryPoint>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y((d) => yRate(d.actual))
        .curve(d3.curveMonotoneX);

      const impliedLine = d3
        .line<ParityHistoryPoint>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y((d) => yRate(d.implied))
        .curve(d3.curveMonotoneX);

      rootG
        .append("path")
        .datum(parityHistory)
        .attr("fill", "none")
        .attr("stroke", "#A78BFA")
        .attr("stroke-width", 2.3)
        .attr("d", actualLine);

      rootG
        .append("path")
        .datum(parityHistory)
        .attr("fill", "none")
        .attr("stroke", "#34D399")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,3")
        .attr("d", impliedLine);

      rootG
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", yBasis(0))
        .attr("y2", yBasis(0))
        .attr("stroke", "#475569")
        .attr("stroke-width", 1);

      rootG
        .append("text")
        .attr("x", 4)
        .attr("y", basisTop - 4)
        .attr("fill", "#94A3B8")
        .attr("font-size", "10px")
        .attr("font-family", "var(--font-mono)")
        .text("CROSS BASIS SPREAD (PIPS = DIRECT CHF-TND − SYNTHETIC CHF-EUR×EUR-TND)");

      rootG
        .selectAll(".basis-bar")
        .data(parityHistory)
        .join("rect")
        .attr("class", "basis-bar")
        .attr("x", (_, i) => xScale(i) ?? 0)
        .attr("width", xScale.bandwidth())
        .attr("y", (d) =>
          d.basisPips >= 0 ? yBasis(d.basisPips) : yBasis(0)
        )
        .attr("height", (d) =>
          Math.max(2, Math.abs(yBasis(d.basisPips) - yBasis(0)))
        )
        .attr("rx", 1.5)
        .attr("fill", (d) => (d.basisPips >= 0 ? "#8B5CF6" : "#10B981"))
        .attr("opacity", 0.85);

      const step = Math.max(1, Math.floor(parityHistory.length / 6));
      const xAxisG = rootG
        .append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(
          d3
            .axisBottom(xScale)
            .tickValues(d3.range(0, parityHistory.length, step))
            .tickFormat((idx) => {
              const pt = parityHistory[Number(idx)];
              if (!pt) return "";
              const d = new Date(pt.timestamp);
              return `${String(d.getHours()).padStart(2, "0")}:00`;
            })
        );
      xAxisG.selectAll("path, line").attr("stroke", "#334155");
      xAxisG
        .selectAll("text")
        .attr("fill", "#94A3B8")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", "10px");

      return;
    }

    // AREA + BOLLINGER OR OHLC + EMA MODE
    if (visibleCandles.length === 0) return;

    const mainPriceH = innerHeight * 0.78;
    const volTop = mainPriceH + 12;
    const volH = innerHeight - volTop;

    const xScale = d3
      .scaleBand<number>()
      .domain(d3.range(visibleCandles.length))
      .range([0, innerWidth])
      .padding(0.28);

    const lowVals = visibleCandles.map((c) => c.low);
    const highVals = visibleCandles.map((c) => c.high);
    if (chartStyle === "AREA") {
      indicators.bollinger.forEach((b) => {
        lowVals.push(b.lower);
        highVals.push(b.upper);
      });
    }
    lowVals.push(currentMid);
    highVals.push(currentMid);

    const minPrice = d3.min(lowVals) ?? spec.baselineMid * 0.99;
    const maxPrice = d3.max(highVals) ?? spec.baselineMid * 1.01;
    const priceSpan = maxPrice - minPrice || spec.pipSize * 10;

    const yPrice = d3
      .scaleLinear()
      .domain([minPrice - priceSpan * 0.08, maxPrice + priceSpan * 0.08])
      .range([mainPriceH, 0]);

    const maxVol = d3.max(visibleCandles, (c) => c.volume) ?? 3000;
    const yVol = d3
      .scaleLinear()
      .domain([0, maxVol * 1.1])
      .range([volTop + volH, volTop]);

    const yTicks = yPrice.ticks(6);
    rootG
      .append("g")
      .selectAll("line")
      .data(yTicks)
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => yPrice(d))
      .attr("y2", (d) => yPrice(d))
      .attr("stroke", "#1E293B")
      .attr("stroke-dasharray", "2,3");

    const yAxis = d3
      .axisRight(yPrice)
      .ticks(6)
      .tickFormat((d) => Number(d).toFixed(spec.digits));
    const yAxisG = rootG
      .append("g")
      .attr("transform", `translate(${innerWidth},0)`)
      .call(yAxis);
    yAxisG.selectAll("path, line").attr("stroke", "#334155");
    yAxisG
      .selectAll("text")
      .attr("fill", "#94A3B8")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", "10.5px");

    const step = Math.max(1, Math.floor(visibleCandles.length / 7));
    const xAxisG = rootG
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues(d3.range(0, visibleCandles.length, step))
          .tickFormat((idx) => {
            const c = visibleCandles[Number(idx)];
            if (!c) return "";
            const d = new Date(c.timestamp);
            if (timeframe === "1D" || timeframe === "4H") {
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }
            return `${String(d.getHours()).padStart(2, "0")}:${String(
              d.getMinutes()
            ).padStart(2, "0")}`;
          })
      );
    xAxisG.selectAll("path, line").attr("stroke", "#334155");
    xAxisG
      .selectAll("text")
      .attr("fill", "#94A3B8")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", "10px");

    // Relative Activity Histogram Bars at Bottom
    rootG
      .selectAll(".vol-bar")
      .data(visibleCandles)
      .join("rect")
      .attr("class", "vol-bar")
      .attr("x", (_, i) => xScale(i) ?? 0)
      .attr("width", xScale.bandwidth())
      .attr("y", (d) => yVol(d.volume))
      .attr("height", (d) => Math.max(1, volTop + volH - yVol(d.volume)))
      .attr("rx", 1)
      .attr("fill", (d) => (d.close >= d.open ? "#10B981" : "#F43F5E"))
      .attr("opacity", 0.26);

    if (chartStyle === "CANDLES") {
      rootG
        .selectAll(".candle-wick")
        .data(visibleCandles)
        .join("line")
        .attr("class", "candle-wick")
        .attr("x1", (_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .attr("x2", (_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .attr("y1", (d) => yPrice(d.high))
        .attr("y2", (d) => yPrice(d.low))
        .attr("stroke", (d) => (d.close >= d.open ? "#10B981" : "#F43F5E"))
        .attr("stroke-width", 1.35);

      rootG
        .selectAll(".candle-body")
        .data(visibleCandles)
        .join("rect")
        .attr("class", "candle-body")
        .attr("x", (_, i) => xScale(i) ?? 0)
        .attr("width", Math.max(3, xScale.bandwidth()))
        .attr("y", (d) => yPrice(Math.max(d.open, d.close)))
        .attr("height", (d) =>
          Math.max(2, Math.abs(yPrice(d.open) - yPrice(d.close)))
        )
        .attr("rx", 1.2)
        .attr("fill", (d) => (d.close >= d.open ? "#10B981" : "#F43F5E"));

      const emaLine = d3
        .line<number>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y((d) => yPrice(d))
        .curve(d3.curveMonotoneX);

      rootG
        .append("path")
        .datum(indicators.ema9)
        .attr("fill", "none")
        .attr("stroke", "#38BDF8")
        .attr("stroke-width", 1.6)
        .attr("d", emaLine);

      rootG
        .append("path")
        .datum(indicators.ema21)
        .attr("fill", "none")
        .attr("stroke", "#F59E0B")
        .attr("stroke-width", 1.6)
        .attr("d", emaLine);
    } else {
      // AREA + BOLLINGER VOLATILITY BANDS
      const bbArea = d3
        .area<{ upper: number; lower: number }>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y0((d) => yPrice(d.lower))
        .y1((d) => yPrice(d.upper))
        .curve(d3.curveMonotoneX);

      rootG
        .append("path")
        .datum(indicators.bollinger)
        .attr("fill", "url(#d3-fx-bb-grad)")
        .attr("d", bbArea);

      const bbUpperLine = d3
        .line<{ upper: number }>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y((d) => yPrice(d.upper))
        .curve(d3.curveMonotoneX);

      const bbLowerLine = d3
        .line<{ lower: number }>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y((d) => yPrice(d.lower))
        .curve(d3.curveMonotoneX);

      rootG
        .append("path")
        .datum(indicators.bollinger)
        .attr("fill", "none")
        .attr("stroke", "#818CF8")
        .attr("stroke-width", 1.1)
        .attr("stroke-dasharray", "3,3")
        .attr("d", bbUpperLine);

      rootG
        .append("path")
        .datum(indicators.bollinger)
        .attr("fill", "none")
        .attr("stroke", "#818CF8")
        .attr("stroke-width", 1.1)
        .attr("stroke-dasharray", "3,3")
        .attr("d", bbLowerLine);

      const priceArea = d3
        .area<CandlePoint>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y0(mainPriceH)
        .y1((d) => yPrice(d.close))
        .curve(d3.curveMonotoneX);

      const priceLine = d3
        .line<CandlePoint>()
        .x((_, i) => (xScale(i) ?? 0) + xScale.bandwidth() / 2)
        .y((d) => yPrice(d.close))
        .curve(d3.curveMonotoneX);

      rootG
        .append("path")
        .datum(visibleCandles)
        .attr("fill", "url(#d3-fx-area-grad)")
        .attr("d", priceArea);

      rootG
        .append("path")
        .datum(visibleCandles)
        .attr("fill", "none")
        .attr("stroke", "#38BDF8")
        .attr("stroke-width", 2.3)
        .attr("d", priceLine);
    }

    // Live Reference Rate Line + Right-Axis Pill
    const liveY = yPrice(currentMid);
    if (liveY >= 0 && liveY <= mainPriceH) {
      rootG
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", liveY)
        .attr("y2", liveY)
        .attr("stroke", "#38BDF8")
        .attr("stroke-width", 1.25)
        .attr("stroke-dasharray", "3,2");

      const badgeG = rootG
        .append("g")
        .attr("transform", `translate(${innerWidth + 2}, ${liveY - 10})`);

      badgeG
        .append("rect")
        .attr("width", 68)
        .attr("height", 20)
        .attr("rx", 4)
        .attr("fill", "#0284C7");

      badgeG
        .append("text")
        .attr("x", 34)
        .attr("y", 13.5)
        .attr("text-anchor", "middle")
        .attr("fill", "#FFFFFF")
        .attr("font-family", "var(--font-mono)")
        .attr("font-weight", "600")
        .attr("font-size", "10.5px")
        .text(formatRate(pair, currentMid));
    }

    // Interactive Crosshair
    if (hoveredIdx !== null && visibleCandles[hoveredIdx]) {
      const cx = (xScale(hoveredIdx) ?? 0) + xScale.bandwidth() / 2;
      rootG
        .append("line")
        .attr("x1", cx)
        .attr("x2", cx)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#64748B")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

      if (hoverPriceY !== null && hoverPriceY >= 0 && hoverPriceY <= mainPriceH) {
        const cursorPrice = yPrice.invert(hoverPriceY);
        rootG
          .append("line")
          .attr("x1", 0)
          .attr("x2", innerWidth)
          .attr("y1", hoverPriceY)
          .attr("y2", hoverPriceY)
          .attr("stroke", "#64748B")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,3");

        const cursorBadge = rootG
          .append("g")
          .attr(
            "transform",
            `translate(${innerWidth + 2}, ${hoverPriceY - 10})`
          );
        cursorBadge
          .append("rect")
          .attr("width", 68)
          .attr("height", 20)
          .attr("rx", 4)
          .attr("fill", "#334155");
        cursorBadge
          .append("text")
          .attr("x", 34)
          .attr("y", 13.5)
          .attr("text-anchor", "middle")
          .attr("fill", "#F8FAFC")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", "10px")
          .text(formatRate(pair, cursorPrice));
      }
    }

    rootG
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mousemove", function (event) {
        const [mx, my] = d3.pointer(event);
        const stepWidth = innerWidth / visibleCandles.length;
        const idx = Math.max(
          0,
          Math.min(visibleCandles.length - 1, Math.floor(mx / stepWidth))
        );
        setHoveredIdx(idx);
        setHoverPriceY(my);
      })
      .on("mouseleave", function () {
        setHoveredIdx(null);
        setHoverPriceY(null);
      });
  }, [
    dimensions,
    chartStyle,
    visibleCandles,
    parityHistory,
    indicators,
    pair,
    timeframe,
    currentMid,
    hoveredIdx,
    hoverPriceY,
    spec.baselineMid,
    spec.digits,
    spec.pipSize,
  ]);

  const activeCandle =
    hoveredIdx !== null && visibleCandles[hoveredIdx]
      ? visibleCandles[hoveredIdx]
      : visibleCandles[visibleCandles.length - 1];

  return (
    <div className="rounded-2xl bg-[#0B1120] border border-slate-800 shadow-lg overflow-hidden text-slate-100">
      {/* Chart Header */}
      <div className="px-4 py-3.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3 bg-[#0F172A]/85">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-mono text-base font-bold tracking-tight text-white">
              {pair}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              {spec.name}
            </span>
          </div>

          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setChartStyle("AREA")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                chartStyle === "AREA"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Area + Bollinger</span>
            </button>
            <button
              type="button"
              onClick={() => setChartStyle("CANDLES")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                chartStyle === "CANDLES"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CandlestickChart className="w-3.5 h-3.5" />
              <span>OHLC + EMA</span>
            </button>
            <button
              type="button"
              onClick={() => setChartStyle("PARITY")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                chartStyle === "PARITY"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              <span>Cross-Rate Parity</span>
            </button>
          </div>
        </div>

        {/* Timeframe Switcher */}
        {chartStyle !== "PARITY" && (
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 py-1 rounded-md font-mono text-xs font-semibold transition ${
                  timeframe === tf
                    ? "bg-slate-700 text-sky-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Telemetry Readout Bar */}
      <div className="px-4 py-2 border-b border-slate-800/70 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        {chartStyle === "PARITY" ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-violet-300">
              <span className="w-2.5 h-0.5 bg-violet-400 inline-block" />
              Direct CHF-TND
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
              Synthetic CHF-EUR × EUR-TND
            </span>
            <span className="text-slate-400">
              D3.js Triangular Parity Basis Monitor
            </span>
          </div>
        ) : activeCandle ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-slate-400">
              OPEN{" "}
              <strong className="text-slate-200">
                {formatRate(pair, activeCandle.open)}
              </strong>
            </span>
            <span className="text-slate-400">
              HIGH{" "}
              <strong className="text-emerald-400">
                {formatRate(pair, activeCandle.high)}
              </strong>
            </span>
            <span className="text-slate-400">
              LOW{" "}
              <strong className="text-rose-400">
                {formatRate(pair, activeCandle.low)}
              </strong>
            </span>
            <span className="text-slate-400">
              RATE{" "}
              <strong className="text-sky-300">
                {formatRate(pair, activeCandle.close)}
              </strong>
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-3 text-[11px]">
          {chartStyle === "CANDLES" && (
            <>
              <span className="inline-flex items-center gap-1 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> EMA 9
              </span>
              <span className="inline-flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> EMA 21
              </span>
            </>
          )}
          {chartStyle === "AREA" && (
            <span className="inline-flex items-center gap-1 text-indigo-300">
              <Activity className="w-3 h-3" /> Volatility Channel (2σ)
            </span>
          )}
          <span className="text-slate-500">D3.js v7 SVG</span>
        </div>
      </div>

      {/* D3 SVG Canvas */}
      <div ref={containerRef} className="w-full relative bg-[#0B1120]">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block w-full select-none"
        />
      </div>
    </div>
  );
}
