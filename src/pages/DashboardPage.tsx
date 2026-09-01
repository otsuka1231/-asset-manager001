import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Account, Snapshot } from "../types";
import { ASSET_CATEGORY_LABELS } from "../types";
import type { Scope } from "../metrics";
import {
  SCOPE_LABELS,
  SERIES_COLORS,
  computeMetrics,
  scopeAccounts,
  toSlices,
  buildSeries,
  yen,
  yenAxis,
  yenDelta,
  pct,
} from "../metrics";

interface Props {
  accounts: Account[];
  snapshots: Snapshot[];
}

const RANGES = [
  { key: "3m", label: "3ヶ月", months: 3 },
  { key: "6m", label: "6ヶ月", months: 6 },
  { key: "1y", label: "1年", months: 12 },
  { key: "all", label: "全期間", months: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/** Change indicator. Deliberately avoids red/green: in Japan red means "up" on
 *  price boards while the rest of the world reads it as a loss, and ~8% of men
 *  cannot separate the two. Direction is carried by an arrow and a sign. */
function Delta({ value, base }: { value: number; base: number | null }) {
  if (base === null) return null;
  const diff = value - base;
  const ratio = base !== 0 ? (diff / Math.abs(base)) * 100 : 0;
  const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
  return (
    <span className={`delta delta-${dir}`}>
      <span className="delta-arrow" aria-hidden="true">{arrow}</span>
      {yenDelta(diff)}
      {base !== 0 && <span className="delta-pct">({diff > 0 ? "+" : ""}{ratio.toFixed(1)}%)</span>}
    </span>
  );
}

interface SeriesPoint {
  純資産: number;
  負債: number;
  総資産: number;
}

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: { payload: SeriesPoint }[];
}

function ChartTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tip">
      <div className="chart-tip-date">{label}</div>
      <div className="chart-tip-row">
        <span><i style={{ background: SERIES_COLORS.net }} />純資産</span>
        <b>{yen(row.純資産)}</b>
      </div>
      <div className="chart-tip-row">
        <span><i style={{ background: SERIES_COLORS.liabilities }} />負債</span>
        <b>{yen(row.負債)}</b>
      </div>
      <div className="chart-tip-row total">
        <span>総資産</span>
        <b>{yen(row.総資産)}</b>
      </div>
    </div>
  );
}

export default function DashboardPage({ accounts, snapshots }: Props) {
  const [scope, setScope] = useState<Scope>("all");
  const [range, setRange] = useState<RangeKey>("1y");

  const m = useMemo(() => computeMetrics(accounts, snapshots, scope), [accounts, snapshots, scope]);

  const slices = useMemo(
    () => toSlices(m.assetsByCategory, ASSET_CATEGORY_LABELS),
    [m.assetsByCategory]
  );

  const series = useMemo(() => {
    const scoped = scopeAccounts(accounts, scope);
    const all = buildSeries(scoped, snapshots);
    const months = RANGES.find((r) => r.key === range)!.months;
    if (!months) return all;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const iso = cutoff.toISOString().slice(0, 10);
    const windowed = all.filter((d) => d.date >= iso);
    // Never render a single lonely point — fall back to the full series.
    return windowed.length >= 2 ? windowed : all.slice(-2);
  }, [accounts, snapshots, scope, range]);

  if (!m.hasData) {
    return (
      <div className="page">
        <div className="empty-state">
          <img className="empty-mascot" src="nyasper/hearts.png" alt="" />
          <p className="empty-text">
            「記録」タブから残高を入力すると、
            <br />ここに資産の内訳と推移が表示されます。
          </p>
        </div>
      </div>
    );
  }

  const investable = m.riskAssets + m.safeAssets;
  const riskShare = investable > 0 ? (m.riskAssets / investable) * 100 : 0;

  return (
    <div className="page">
      {/* Scope toggle — household by default */}
      {m.hasShared && (
        <div className="scope-toggle" role="tablist" aria-label="表示する名義">
          {(["all", "self", "shared"] as Scope[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              className={scope === s ? "active" : ""}
              onClick={() => setScope(s)}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Hero — net worth is the one number that gets full size */}
      <section className="hero">
        <img className="hero-mascot" src="nyasper/happy.png" alt="" aria-hidden="true" />
        <div className="hero-label">純資産{scope !== "all" && `（${SCOPE_LABELS[scope]}）`}</div>
        <div className="hero-value">{yen(m.total.net)}</div>
        <div className="hero-delta">
          <Delta value={m.total.net} base={m.prev?.net ?? null} />
          {m.prevDate && <span className="hero-since">前回 {m.prevDate} から</span>}
        </div>

        <div className="hero-split">
          <div>
            <span className="hero-split-label">総資産</span>
            <span className="hero-split-value">{yen(m.total.assets)}</span>
          </div>
          <div>
            <span className="hero-split-label">総負債</span>
            <span className="hero-split-value">{yen(m.total.liabilities)}</span>
          </div>
        </div>

        {m.hasShared && scope === "all" && (
          <div className="hero-owners">
            うち 本人 {yen(m.byOwner.self.net)} ／ 共有 {yen(m.byOwner.shared.net)}
          </div>
        )}
      </section>

      {/* Allocation — donut for the impression, labelled list for the reading.
          Recharts has no label-collision avoidance, so slices carry no SVG labels. */}
      {slices.length > 0 && (
        <section className="card">
          <h3><img className="mini-mascot" src="nyasper/lolli.png" alt="" aria-hidden="true" />資産配分</h3>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="64%"
                  outerRadius="92%"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={false}
                  label={false}
                  labelLine={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span className="donut-center-label">総資産</span>
              <span className="donut-center-value">{yen(m.total.assets)}</span>
            </div>
          </div>

          <ul className="alloc-list">
            {slices.map((s) => (
              <li key={s.key}>
                <div className="alloc-head">
                  <span className="alloc-name">
                    <i className="swatch" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="alloc-figures">
                    <b>{yen(s.value)}</b>
                    <span className="alloc-share">{pct(s.share)}</span>
                  </span>
                </div>
                <div className="alloc-bar">
                  <div style={{ width: `${s.share}%`, background: s.color }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Risk vs cash — Japanese households hold ~55% in cash, so this ratio
          is the single most self-revealing number after net worth. */}
      {investable > 0 && (
        <section className="card">
          <h3><img className="mini-mascot" src="nyasper/face.png" alt="" aria-hidden="true" />リスク資産と現預金</h3>
          <div className="split-band">
            <div className="split-band-fill risk" style={{ width: `${riskShare}%` }} />
            <div className="split-band-fill safe" style={{ width: `${100 - riskShare}%` }} />
          </div>
          <div className="split-legend">
            <div>
              <span className="split-name"><i className="swatch risk" />リスク資産</span>
              <b>{yen(m.riskAssets)}</b>
              <span className="split-share">{pct(riskShare, 0)}</span>
            </div>
            <div>
              <span className="split-name"><i className="swatch safe" />現預金</span>
              <b>{yen(m.safeAssets)}</b>
              <span className="split-share">{pct(100 - riskShare, 0)}</span>
            </div>
          </div>
          <p className="card-note">株式・投資信託・仮想通貨などの値動きする資産の割合です。</p>
        </section>
      )}

      {/* Housing loan — a progress bar reads faster than a raw balance */}
      {(m.loans.length > 0 || m.liabilitiesByCategory.size > 0) && (
        <section className="card">
          <h3><img className="mini-mascot" src="nyasper/zen.png" alt="" aria-hidden="true" />負債</h3>

          {m.loans.map((loan) => (
            <div key={loan.accountId} className="loan">
              <div className="loan-head">
                <span className="loan-name">{loan.name}</span>
                <span className="loan-progress-pct">{pct(loan.progress, 1)} 返済済</span>
              </div>
              <div className="loan-bar">
                <div style={{ width: `${loan.progress}%` }} />
              </div>
              <div className="loan-figures">
                <span>残り <b>{yen(loan.balance)}</b></span>
                <span className="loan-muted">当初 {yen(loan.originalAmount)}</span>
              </div>
            </div>
          ))}

          <ul className="mini-list">
            {m.plainLiabilities.map((l) => (
              <li key={l.accountId}>
                <span>{l.name}</span>
                <b>{yen(l.amount)}</b>
              </li>
            ))}
            <li className="mini-list-total">
              <span>総資産に対する負債比率</span>
              <b>{pct(m.debtRatio, 1)}</b>
            </li>
          </ul>
        </section>
      )}

      {/* Trend — 純資産 and 負債 stack to 総資産, which is a true part-to-whole */}
      <section className="card">
        <div className="card-head">
          <h3><img className="mini-mascot" src="nyasper/mirror.png" alt="" aria-hidden="true" />資産推移</h3>
        </div>
        <div className="range-toggle">
          {RANGES.map((r) => (
            <button key={r.key} className={range === r.key ? "active" : ""} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={series} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.net} stopOpacity={0.55} />
                <stop offset="100%" stopColor={SERIES_COLORS.net} stopOpacity={0.15} />
              </linearGradient>
              <linearGradient id="gLia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.liabilities} stopOpacity={0.45} />
                <stop offset="100%" stopColor={SERIES_COLORS.liabilities} stopOpacity={0.12} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#ece6f3" />
            <XAxis
              dataKey="label"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={26}
            />
            <YAxis
              fontSize={11}
              tickFormatter={yenAxis}
              width={46}
              tickCount={4}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="純資産"
              stackId="a"
              stroke={SERIES_COLORS.net}
              strokeWidth={2}
              fill="url(#gNet)"
            />
            <Area
              type="monotone"
              dataKey="負債"
              stackId="a"
              stroke={SERIES_COLORS.liabilities}
              strokeWidth={2}
              fill="url(#gLia)"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          <span><i style={{ background: SERIES_COLORS.net }} />純資産</span>
          <span><i style={{ background: SERIES_COLORS.liabilities }} />負債</span>
          <span className="chart-legend-note">積み上げの高さ＝総資産</span>
        </div>
      </section>
    </div>
  );
}
