"use client";

import { useMemo, useState } from "react";
import { PAIRS, PAIR_INFO, type Currency, type DayRates, type Pair, type RatesPayload } from "@/lib/rates";

const ACCENT: Record<Pair, string> = {
  "CHF-EUR": "#60a5fa",
  "EUR-TND": "#f5b942",
  "CHF-TND": "#2dd4bf",
};

const PERIODS = [
  { label: "7 j", days: 7 },
  { label: "30 j", days: 30 },
  { label: "90 j", days: 90 },
] as const;

const fmt = (n: number, d = 4) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (iso: string, long = false) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });

function change(history: DayRates[], pair: Pair, days: number) {
  const slice = history.slice(-days);
  const first = slice[0]?.[pair];
  const last = slice[slice.length - 1]?.[pair];
  if (!first || !last) return 0;
  return ((last - first) / first) * 100;
}

function Change({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={`tabular-nums text-sm font-medium ${up ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? "▲" : "▼"} {fmt(Math.abs(pct), 2)} %
    </span>
  );
}

function Chart({ data, pair }: { data: DayRates[]; pair: Pair }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = 280;
  const pad = { t: 16, r: 16, b: 28, l: 64 };

  const values = data.map((d) => d[pair]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max * 0.01;
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;

  const x = (i: number) => pad.l + (i / Math.max(data.length - 1, 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(values.length - 1)},${H - pad.b}L${x(0)},${H - pad.b}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * (hi - lo));
  const color = ACCENT[pair];
  const h = hover !== null ? data[hover] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full select-none"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
        setHover(Math.min(Math.max(i, 0), data.length - 1));
      }}
    >
      <defs>
        <linearGradient id={`g-${pair}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#22304a" strokeDasharray="3 4" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-500 font-mono text-[11px]">
            {fmt(t)}
          </text>
        </g>
      ))}
      {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="fill-slate-500 text-[11px]">
          {data[i] && fmtDate(data[i].date)}
        </text>
      ))}
      <path d={area} fill={`url(#g-${pair})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" />
      {h && hover !== null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#475569" />
          <circle cx={x(hover)} cy={y(h[pair])} r="4.5" fill={color} stroke="#0c1222" strokeWidth="2" />
          <g transform={`translate(${Math.min(x(hover) + 10, W - 150)},${pad.t + 4})`}>
            <rect width="140" height="42" rx="8" fill="#0c1222" stroke="#22304a" />
            <text x="10" y="17" className="fill-slate-400 text-[11px]">{fmtDate(h.date, true)}</text>
            <text x="10" y="34" className="fill-slate-100 font-mono text-[13px]">{fmt(h[pair])}</text>
          </g>
        </g>
      )}
    </svg>
  );
}

function Converter({ latest }: { latest: DayRates }) {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState<Currency>("CHF");
  const n = Number(amount.replace(",", ".")) || 0;

  const toChf: Record<Currency, number> = {
    CHF: 1,
    EUR: 1 / latest["CHF-EUR"],
    TND: 1 / latest["CHF-TND"],
  };
  const fromChf: Record<Currency, number> = {
    CHF: 1,
    EUR: latest["CHF-EUR"],
    TND: latest["CHF-TND"],
  };
  const chf = n * toChf[from];
  const names: Record<Currency, string> = { CHF: "Franc suisse", EUR: "Euro", TND: "Dinar tunisien" };

  return (
    <div className="rounded-2xl border border-[#22304a] bg-[#131b2e] p-6">
      <h2 className="text-lg font-semibold text-slate-100">Convertisseur</h2>
      <div className="mt-4 flex gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full min-w-0 rounded-xl border border-[#22304a] bg-[#0c1222] px-4 py-3 font-mono text-lg text-slate-100 outline-none focus:border-amber-400"
          aria-label="Montant"
        />
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value as Currency)}
          className="rounded-xl border border-[#22304a] bg-[#0c1222] px-3 text-slate-100 outline-none focus:border-amber-400"
          aria-label="Devise de départ"
        >
          {(["CHF", "EUR", "TND"] as Currency[]).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <ul className="mt-5 space-y-3">
        {(["CHF", "EUR", "TND"] as Currency[])
          .filter((c) => c !== from)
          .map((c) => (
            <li key={c} className="flex items-baseline justify-between rounded-xl bg-[#0c1222] px-4 py-3">
              <span className="text-sm text-slate-400">{names[c]}</span>
              <span className="font-mono text-xl text-slate-100">
                {fmt(chf * fromChf[c], c === "TND" ? 3 : 2)} <span className="text-sm text-slate-500">{c}</span>
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function RatesDashboard({ data }: { data: RatesPayload }) {
  const [pair, setPair] = useState<Pair>("CHF-EUR");
  const [days, setDays] = useState<number>(30);
  const { latest, history } = data;
  const prev = history[history.length - 2];
  const visible = useMemo(() => history.slice(-days), [history, days]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">CHF · EUR · TND</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50 sm:text-4xl">Taux de change</h1>
        </div>
        <p className="text-sm text-slate-400">
          Taux du <span className="text-slate-200">{fmtDate(latest.date, true)}</span>
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {PAIRS.map((p) => {
          const info = PAIR_INFO[p];
          const day = prev ? ((latest[p] - prev[p]) / prev[p]) * 100 : 0;
          const active = p === pair;
          return (
            <button
              key={p}
              onClick={() => setPair(p)}
              className={`rounded-2xl border p-5 text-left transition ${
                active ? "border-transparent bg-[#18223a] ring-2" : "border-[#22304a] bg-[#131b2e] hover:bg-[#18223a]"
              }`}
              style={active ? ({ "--tw-ring-color": ACCENT[p] } as React.CSSProperties) : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">
                  {info.base} / {info.quote}
                </span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT[p] }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{info.label}</p>
              <p className="mt-4 font-mono text-3xl text-slate-50">{fmt(latest[p])}</p>
              <div className="mt-2 flex items-center gap-2">
                <Change pct={day} />
                <span className="text-xs text-slate-500">sur 1 jour</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                1 {info.quote} = {fmt(1 / latest[p])} {info.base}
              </p>
            </button>
          );
        })}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-[#22304a] bg-[#131b2e] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Évolution {PAIR_INFO[pair].base} / {PAIR_INFO[pair].quote}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <Change pct={change(history, pair, days)} />
                <span className="text-xs text-slate-500">sur {days} jours</span>
              </div>
            </div>
            <div className="flex rounded-xl bg-[#0c1222] p-1">
              {PERIODS.map((pd) => (
                <button
                  key={pd.days}
                  onClick={() => setDays(pd.days)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    days === pd.days ? "bg-amber-400 font-medium text-slate-900" : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {pd.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Chart data={visible} pair={pair} />
          </div>
        </div>
        <Converter latest={latest} />
      </section>

      <footer className="mt-10 text-xs text-slate-500">
        Données réelles, mises à jour une fois par jour. Source : {data.source}. Taux indicatifs moyens, sans
        marge bancaire.
      </footer>
    </main>
  );
}
