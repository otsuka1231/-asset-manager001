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
} from "recharts";
import type { Account, Snapshot, AssetCategory, LiabilityCategory, Owner } from "../types";
import { ASSET_CATEGORY_LABELS, LIABILITY_CATEGORY_LABELS, OWNER_LABELS, ownerOf } from "../types";

interface Props {
  accounts: Account[];
  snapshots: Snapshot[];
}

function yen(n: number): string {
  if (Math.abs(n) >= 100_000_000) return (n / 100_000_000).toFixed(2) + "億円";
  if (Math.abs(n) >= 10_000) return (n / 10_000).toFixed(0) + "万円";
  return n.toLocaleString() + "円";
}

export default function DashboardPage({ accounts, snapshots }: Props) {
  const latest = snapshots[snapshots.length - 1] ?? null;

  const {
    totalAssets,
    totalLiabilities,
    netWorth,
    assetByOwner,
    liabilityBreakdown,
    ownerNet,
    hasShared,
  } = useMemo(() => {
    let assets = 0;
    let liabs = 0;
    const lBreak = new Map<LiabilityCategory, number>();
    const assetOwner = new Map<Owner, Map<AssetCategory, number>>([
      ["self", new Map()],
      ["shared", new Map()],
    ]);
    const owners = new Map<Owner, { assets: number; liabs: number }>([
      ["self", { assets: 0, liabs: 0 }],
      ["shared", { assets: 0, liabs: 0 }],
    ]);
    const sharedExists = accounts.some((a) => ownerOf(a) === "shared");

    if (latest) {
      for (const b of latest.balances) {
        const account = accounts.find((a) => a.id === b.accountId);
        if (!account) continue;
        const owner = ownerOf(account);
        const bucket = owners.get(owner)!;
        if (account.type === "asset") {
          assets += b.amount;
          bucket.assets += b.amount;
          const cat = account.category as AssetCategory;
          const m = assetOwner.get(owner)!;
          m.set(cat, (m.get(cat) || 0) + b.amount);
        } else {
          liabs += b.amount;
          bucket.liabs += b.amount;
          const cat = account.category as LiabilityCategory;
          lBreak.set(cat, (lBreak.get(cat) || 0) + b.amount);
        }
      }
    }

    return {
      totalAssets: assets,
      totalLiabilities: liabs,
      netWorth: assets - liabs,
      assetByOwner: assetOwner,
      liabilityBreakdown: lBreak,
      ownerNet: owners,
      hasShared: sharedExists,
    };
  }, [latest, accounts]);

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
        date: s.date.slice(5, 10),
        資産: assets,
        負債: liabs,
        純資産: assets - liabs,
      };
    });
  }, [snapshots, accounts]);

  if (snapshots.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <img className="empty-mascot" src="nyasper/hearts.png" alt="" />
          <p className="empty-text">
            「記録」タブから残高を入力すると、
            <br />ここに資産の推移が表示されます。
          </p>
        </div>
      </div>
    );
  }

  const renderBreakdown = (m: Map<AssetCategory, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => (
        <div key={cat} className="breakdown-row">
          <span>{ASSET_CATEGORY_LABELS[cat] ?? cat}</span>
          <span>{yen(amount)}</span>
        </div>
      ));

  const selfNet = ownerNet.get("self")!;
  const sharedNet = ownerNet.get("shared")!;

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
          <img className="net-mascot" src="nyasper/happy.png" alt="" aria-hidden="true" />
          <span className="summary-label">純資産</span>
          <span className="summary-value">{yen(netWorth)}</span>
        </div>
      </div>

      {/* Owner net summary */}
      {hasShared && (
        <div className="breakdown">
          <h3><img className="mini-mascot" src="nyasper/sit.png" alt="" aria-hidden="true" />名義の内訳</h3>
          <div className="breakdown-row">
            <span>{OWNER_LABELS.self}（純資産）</span>
            <span>{yen(selfNet.assets - selfNet.liabs)}</span>
          </div>
          <div className="breakdown-row">
            <span>{OWNER_LABELS.shared}（純資産）</span>
            <span>{yen(sharedNet.assets - sharedNet.liabs)}</span>
          </div>
        </div>
      )}

      {/* Asset breakdown — split per owner when a shared account exists */}
      {hasShared ? (
        <>
          <div className="breakdown">
            <h3><img className="mini-mascot" src="nyasper/lolli.png" alt="" aria-hidden="true" />資産内訳（{OWNER_LABELS.self}）</h3>
            {assetByOwner.get("self")!.size > 0
              ? renderBreakdown(assetByOwner.get("self")!)
              : <p className="breakdown-empty">記録なし</p>}
          </div>
          <div className="breakdown">
            <h3><img className="mini-mascot" src="nyasper/zen.png" alt="" aria-hidden="true" />資産内訳（{OWNER_LABELS.shared}）</h3>
            {assetByOwner.get("shared")!.size > 0
              ? renderBreakdown(assetByOwner.get("shared")!)
              : <p className="breakdown-empty">記録なし</p>}
          </div>
        </>
      ) : (
        <div className="breakdown">
          <h3><img className="mini-mascot" src="nyasper/lolli.png" alt="" aria-hidden="true" />資産内訳</h3>
          {renderBreakdown(assetByOwner.get("self")!)}
        </div>
      )}

      {/* Liability Breakdown */}
      {liabilityBreakdown.size > 0 && (
        <div className="breakdown">
          <h3><img className="mini-mascot" src="nyasper/face.png" alt="" aria-hidden="true" />負債内訳</h3>
          {[...liabilityBreakdown.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amount]) => (
              <div key={cat} className="breakdown-row">
                <span>{LIABILITY_CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="liability-amount">{yen(amount)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Chart — mascot sits beside the title, not over the plot */}
      <div className="chart-section">
        <div className="chart-head">
          <h3>資産推移</h3>
          <img className="chart-mascot" src="nyasper/mirror.png" alt="" aria-hidden="true" />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ecf5" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => yen(v)} width={64} />
            <Tooltip formatter={(v) => yen(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="資産" stroke="#34c0a0" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="負債" stroke="#e8889e" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="純資産" stroke="#9d8ec4" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
