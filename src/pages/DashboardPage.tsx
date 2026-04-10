import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Account, Snapshot, GoalConfig, AssetCategory } from "../types";
import { ASSET_CATEGORY_LABELS } from "../types";

interface Props {
  accounts: Account[];
  snapshots: Snapshot[];
  goal: GoalConfig;
}

function yen(n: number): string {
  if (Math.abs(n) >= 100_000_000) return (n / 100_000_000).toFixed(2) + "億円";
  if (Math.abs(n) >= 10_000) return (n / 10_000).toFixed(0) + "万円";
  return n.toLocaleString() + "円";
}

export default function DashboardPage({ accounts, snapshots, goal }: Props) {
  const latest = snapshots[snapshots.length - 1] ?? null;

  const { totalAssets, totalLiabilities, netWorth, categoryBreakdown } = useMemo(() => {
    if (!latest) return { totalAssets: 0, totalLiabilities: 0, netWorth: 0, categoryBreakdown: new Map<string, number>() };

    let assets = 0;
    let liabs = 0;
    const breakdown = new Map<string, number>();

    for (const b of latest.balances) {
      const account = accounts.find((a) => a.id === b.accountId);
      if (!account) continue;
      if (account.type === "asset") {
        assets += b.amount;
        const cat = account.category as AssetCategory;
        breakdown.set(cat, (breakdown.get(cat) || 0) + b.amount);
      } else {
        liabs += b.amount;
      }
    }
    return { totalAssets: assets, totalLiabilities: liabs, netWorth: assets - liabs, categoryBreakdown: breakdown };
  }, [latest, accounts]);

  // Goal calculations
  const goalCalc = useMemo(() => {
    const now = new Date();
    const target = new Date(goal.targetDate);
    const monthsLeft = Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
    const remaining = goal.targetAmount - netWorth;
    const simpleMonthly = monthsLeft > 0 ? remaining / monthsLeft : 0;

    // Investment-aware projection
    let investmentAssets = 0;
    let weightedReturn = 0;
    let nonInvestmentAssets = netWorth;

    if (latest) {
      for (const b of latest.balances) {
        const account = accounts.find((a) => a.id === b.accountId);
        if (!account || account.type !== "asset") continue;
        if (account.category === "securities" && account.holdings?.length) {
          const holding = account.holdings.find((h) => h.id === b.holdingId);
          if (holding) {
            investmentAssets += b.amount;
            weightedReturn += b.amount * holding.expectedAnnualReturn;
          }
        } else if (account.expectedAnnualReturn) {
          investmentAssets += b.amount;
          weightedReturn += b.amount * account.expectedAnnualReturn;
        }
      }
    }

    nonInvestmentAssets = netWorth - investmentAssets;
    const avgReturn = investmentAssets > 0 ? weightedReturn / investmentAssets : 0;

    // Future value of existing investments
    const years = monthsLeft / 12;
    const futureInvestmentValue = investmentAssets * Math.pow(1 + avgReturn, years);
    const futureNonInvestment = nonInvestmentAssets;
    const futureExisting = futureInvestmentValue + futureNonInvestment;
    const remainingWithGrowth = goal.targetAmount - futureExisting;

    // Monthly savings needed (assuming new savings also invested at avg return)
    let investedMonthly = 0;
    if (monthsLeft > 0 && avgReturn > 0) {
      const monthlyRate = Math.pow(1 + avgReturn, 1 / 12) - 1;
      // FV of annuity: PMT * ((1+r)^n - 1) / r = remainingWithGrowth
      if (remainingWithGrowth > 0) {
        investedMonthly = remainingWithGrowth * monthlyRate / (Math.pow(1 + monthlyRate, monthsLeft) - 1);
      }
    } else if (monthsLeft > 0) {
      investedMonthly = remainingWithGrowth / monthsLeft;
    }

    const progress = goal.targetAmount > 0 ? (netWorth / goal.targetAmount) * 100 : 0;
    const age = Math.floor((now.getTime() - new Date(goal.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const targetAge = Math.floor((target.getTime() - new Date(goal.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    return {
      remaining: Math.max(0, remaining),
      monthsLeft,
      simpleMonthly: Math.max(0, simpleMonthly),
      investedMonthly: Math.max(0, investedMonthly),
      avgReturn,
      progress: Math.min(100, progress),
      age,
      targetAge,
    };
  }, [netWorth, goal, latest, accounts]);

  // Chart data
  const chartData = useMemo(() => {
    return snapshots.map((s) => {
      let assets = 0;
      let liabs = 0;
      for (const b of s.balances) {
        const account = accounts.find((a) => a.id === b.accountId);
        if (!account) continue;
        if (account.type === "asset") assets += b.amount;
        else liabs += b.amount;
      }
      return {
        date: s.date.slice(0, 10),
        資産: assets,
        負債: liabs,
        純資産: assets - liabs,
      };
    });
  }, [snapshots, accounts]);

  if (snapshots.length === 0) {
    return (
      <div className="page">
        <div className="goal-card">
          <h2>目標</h2>
          <p className="goal-target">{yen(goal.targetAmount)}</p>
          <p className="goal-sub">{goalCalc.age}歳 → {goalCalc.targetAge}歳まで（残り{goalCalc.monthsLeft}ヶ月）</p>
        </div>
        <p className="empty-text">「記録する」タブからデータを入力すると、ここにグラフと分析が表示されます。</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card positive">
          <span className="summary-label">総資産</span>
          <span className="summary-value">{yen(totalAssets)}</span>
        </div>
        <div className="summary-card negative">
          <span className="summary-label">総負債</span>
          <span className="summary-value">{yen(totalLiabilities)}</span>
        </div>
        <div className="summary-card net">
          <span className="summary-label">純資産</span>
          <span className="summary-value">{yen(netWorth)}</span>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="breakdown">
        <h3>資産内訳</h3>
        {Array.from(categoryBreakdown.entries()).map(([cat, amount]) => (
          <div key={cat} className="breakdown-row">
            <span>{ASSET_CATEGORY_LABELS[cat as AssetCategory] ?? cat}</span>
            <span>{yen(amount)}</span>
          </div>
        ))}
      </div>

      {/* Goal Progress */}
      <div className="goal-card">
        <h2>目標: {yen(goal.targetAmount)}</h2>
        <p className="goal-sub">{goalCalc.age}歳 → {goalCalc.targetAge}歳（残り{goalCalc.monthsLeft}ヶ月）</p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${goalCalc.progress}%` }} />
        </div>
        <p className="progress-text">{goalCalc.progress.toFixed(1)}% 達成</p>

        <div className="goal-details">
          <div className="goal-row">
            <span>目標まであと</span>
            <span className="goal-amount">{yen(goalCalc.remaining)}</span>
          </div>
          <div className="goal-row">
            <span>必要な月額貯蓄（単純計算）</span>
            <span className="goal-amount">{yen(Math.round(goalCalc.simpleMonthly))}</span>
          </div>
          {goalCalc.avgReturn > 0 && (
            <div className="goal-row highlight">
              <span>投資リターン考慮（年利{(goalCalc.avgReturn * 100).toFixed(1)}%）</span>
              <span className="goal-amount">{yen(Math.round(goalCalc.investedMonthly))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="chart-section">
        <h3>資産推移</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => yen(v)} width={70} />
            <Tooltip formatter={(v) => yen(Number(v))} />
            <Legend />
            <ReferenceLine y={goal.targetAmount} stroke="#f59e0b" strokeDasharray="5 5" label="目標" />
            <Line type="monotone" dataKey="資産" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="負債" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="純資産" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
