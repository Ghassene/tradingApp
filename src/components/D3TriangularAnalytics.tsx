"use client";

import React, { useMemo } from "react";
import * as d3 from "d3";
import type { ForexPair } from "@/lib/forex";
import { ALLOWED_PAIRS, PAIR_SPECS } from "@/lib/forex";
import type { MarketTicker, TriangularParityData } from "@/types/forex";
import { BarChart3, Network } from "lucide-react";

interface D3TriangularAnalyticsProps {
  activePair: ForexPair;
  onSelectPair: (pair: ForexPair) => void;
  tickers: Record<ForexPair, MarketTicker>;
  triangularParity: TriangularParityData;
}

export function D3TriangularAnalytics({
  activePair,
  onSelectPair,
  tickers,
  triangularParity,
}: D3TriangularAnalyticsProps) {
  // Build D3 Horizontal Performance Comparison Chart for the 3 pairs
  const perfBars = useMemo(() => {
    const items = ALLOWED_PAIRS.map((p) => ({
      pair: p,
      name: PAIR_SPECS[p].name,
      changePct: tickers[p]?.changePct ?? 0,
      changePips: tickers[p]?.changePips ?? 0,
      mid: tickers[p]?.mid ?? PAIR_SPECS[p].baselineMid,
    }));

    const maxAbs = Math.max(
      0.25,
      d3.max(items, (d) => Math.abs(d.changePct)) ?? 0.25
    );

    const width = 360;
    const height = 165;
    const margin = { top: 14, right: 56, bottom: 20, left: 72 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xScale = d3
      .scaleLinear()
      .domain([-maxAbs * 1.25, maxAbs * 1.25])
      .range([0, innerW]);

    const yScale = d3
      .scaleBand<ForexPair>()
      .domain(ALLOWED_PAIRS)
      .range([0, innerH])
      .padding(0.32);

    return {
      width,
      height,
      margin,
      innerW,
      innerH,
      zeroX: xScale(0),
      xScale,
      yScale,
      items,
    };
  }, [tickers]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Card 1: D3.js Triangular FX Parity Network */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-50 text-violet-700">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Triangular FX Parity Graph
              </h3>
              <p className="text-xs text-slate-500">
                CHF · EUR · TND cross-rate triangle (click any leg to inspect)
              </p>
            </div>
          </div>
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded font-medium ${
              Math.abs(triangularParity.basisPips) >= 12
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            Basis {triangularParity.basisPips >= 0 ? "+" : ""}
            {triangularParity.basisPips.toFixed(1)} pips
          </span>
        </div>

        <svg viewBox="0 0 360 165" className="w-full h-44 select-none">
          {/* Triangle Legs */}
          <line
            x1={76}
            y1={36}
            x2={284}
            y2={36}
            stroke={activePair === "CHF-EUR" ? "#1D4ED8" : "#CBD5E1"}
            strokeWidth={activePair === "CHF-EUR" ? 2.6 : 1.6}
          />
          <line
            x1={284}
            y1={36}
            x2={180}
            y2={136}
            stroke={activePair === "EUR-TND" ? "#059669" : "#CBD5E1"}
            strokeWidth={activePair === "EUR-TND" ? 2.6 : 1.6}
          />
          <line
            x1={76}
            y1={36}
            x2={180}
            y2={136}
            stroke={activePair === "CHF-TND" ? "#7C3AED" : "#CBD5E1"}
            strokeWidth={activePair === "CHF-TND" ? 2.6 : 1.6}
          />

          {/* Interactive Rate Pills */}
          <g
            onClick={() => onSelectPair("CHF-EUR")}
            className="cursor-pointer"
          >
            <rect
              x={132}
              y={14}
              width={96}
              height={22}
              rx={6}
              fill={activePair === "CHF-EUR" ? "#1D4ED8" : "#F1F5F9"}
            />
            <text
              x={180}
              y={28.5}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill={activePair === "CHF-EUR" ? "#FFFFFF" : "#0F172A"}
              className="font-mono"
            >
              {tickers["CHF-EUR"]?.mid.toFixed(4)}
            </text>
          </g>

          <g
            onClick={() => onSelectPair("EUR-TND")}
            className="cursor-pointer"
          >
            <rect
              x={224}
              y={76}
              width={96}
              height={22}
              rx={6}
              fill={activePair === "EUR-TND" ? "#059669" : "#F1F5F9"}
            />
            <text
              x={272}
              y={90.5}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill={activePair === "EUR-TND" ? "#FFFFFF" : "#0F172A"}
              className="font-mono"
            >
              {tickers["EUR-TND"]?.mid.toFixed(4)}
            </text>
          </g>

          <g
            onClick={() => onSelectPair("CHF-TND")}
            className="cursor-pointer"
          >
            <rect
              x={40}
              y={76}
              width={96}
              height={22}
              rx={6}
              fill={activePair === "CHF-TND" ? "#7C3AED" : "#F1F5F9"}
            />
            <text
              x={88}
              y={90.5}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill={activePair === "CHF-TND" ? "#FFFFFF" : "#0F172A"}
              className="font-mono"
            >
              {tickers["CHF-TND"]?.mid.toFixed(4)}
            </text>
          </g>

          {/* Center Synthetic Cross Readout */}
          <text
            x={180}
            y={64}
            textAnchor="middle"
            fontSize="9.5"
            fill="#64748B"
            className="font-mono"
          >
            Synthetic: {triangularParity.impliedChfTnd.toFixed(4)}
          </text>

          {/* Currency Nodes */}
          <g transform="translate(76, 36)">
            <circle r={20} fill="#0F172A" />
            <text
              y={4}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="700"
              className="font-mono"
            >
              CHF
            </text>
          </g>

          <g transform="translate(284, 36)">
            <circle r={20} fill="#0F172A" />
            <text
              y={4}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="700"
              className="font-mono"
            >
              EUR
            </text>
          </g>

          <g transform="translate(180, 136)">
            <circle r={20} fill="#0F172A" />
            <text
              y={4}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="700"
              className="font-mono"
            >
              TND
            </text>
          </g>
        </svg>
      </div>

      {/* Card 2: D3.js 24h Relative Performance Comparison */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                24-Hour Relative Momentum
              </h3>
              <p className="text-xs text-slate-500">
                D3.js diverging change comparison (% & pips)
              </p>
            </div>
          </div>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            24H WINDOW
          </span>
        </div>

        <svg
          viewBox={`0 0 ${perfBars.width} ${perfBars.height}`}
          className="w-full h-44 select-none"
        >
          <g
            transform={`translate(${perfBars.margin.left},${perfBars.margin.top})`}
          >
            {/* Zero baseline */}
            <line
              x1={perfBars.zeroX}
              x2={perfBars.zeroX}
              y1={0}
              y2={perfBars.innerH}
              stroke="#94A3B8"
              strokeWidth={1.2}
            />

            {perfBars.items.map((item) => {
              const y = perfBars.yScale(item.pair) ?? 0;
              const h = perfBars.yScale.bandwidth();
              const isPos = item.changePct >= 0;
              const barX = isPos
                ? perfBars.zeroX
                : perfBars.xScale(item.changePct);
              const barW = Math.max(
                4,
                Math.abs(perfBars.xScale(item.changePct) - perfBars.zeroX)
              );

              return (
                <g
                  key={item.pair}
                  onClick={() => onSelectPair(item.pair)}
                  className="cursor-pointer"
                >
                  <text
                    x={-10}
                    y={y + h / 2 + 4}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight={activePair === item.pair ? "700" : "600"}
                    fill={activePair === item.pair ? "#1D4ED8" : "#0F172A"}
                    className="font-mono"
                  >
                    {item.pair}
                  </text>

                  <rect
                    x={barX}
                    y={y}
                    width={barW}
                    height={h}
                    rx={4}
                    fill={isPos ? "#059669" : "#E11D48"}
                    opacity={activePair === item.pair ? 1 : 0.82}
                  />

                  <text
                    x={isPos ? barX + barW + 6 : barX - 6}
                    y={y + h / 2 + 3.5}
                    textAnchor={isPos ? "start" : "end"}
                    fontSize="10"
                    fontWeight="600"
                    fill={isPos ? "#047857" : "#BE123C"}
                    className="font-mono"
                  >
                    {isPos ? "+" : ""}
                    {item.changePct.toFixed(2)}%
                  </text>
                </g>
              );
            })}

            <text
              x={perfBars.zeroX}
              y={perfBars.innerH + 14}
              textAnchor="middle"
              fontSize="9.5"
              fill="#64748B"
              className="font-mono"
            >
              0.00% BASELINE
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
