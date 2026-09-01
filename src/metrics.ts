import type {
  Account,
  Snapshot,
  AssetCategory,
  LiabilityCategory,
  Owner,
} from "./types";
import { ownerOf, SAFE_CATEGORIES, RISK_CATEGORIES } from "./types";

/** Which slice of the household the dashboard is showing. */
export type Scope = "all" | "self" | "shared";

export const SCOPE_LABELS: Record<Scope, string> = {
  all: "世帯",
  self: "本人",
  shared: "共有",
};

/** Fixed colour per category — colour follows the entity, never its rank, so a
 *  category keeps its colour as amounts change. Validated for contrast, chroma
 *  and colour-vision separation; "other" is a deliberate neutral residual. */
export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  securities: "#0072B2",
  bank: "#B87A00",
  wealthnavi: "#009E73",
  cash: "#D55E00",
  insurance: "#7D5BA6",
  land: "#2E90C4",
  crypto: "#C2407E",
  other: "#94909E",
};

export const SERIES_COLORS = {
  net: "#6B57B0",
  liabilities: "#B87A00",
  assets: "#009E73",
};

/** Largest number of donut slices before the tail folds into "その他". */
export const MAX_SLICES = 5;

export interface Totals {
  assets: number;
  liabilities: number;
  net: number;
}

export interface LoanProgress {
  accountId: string;
  name: string;
  balance: number;
  originalAmount: number;
  repaid: number;
  progress: number; // 0-100
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  share: number; // 0-100
  color: string;
}

export interface Metrics {
  hasData: boolean;
  date: string;
  total: Totals;
  prev: Totals | null;
  prevDate: string | null;
  /** Net worth per owner, always over every account regardless of scope. */
  byOwner: Record<Owner, Totals>;
  hasShared: boolean;
  assetsByCategory: Map<AssetCategory, number>;
  liabilitiesByCategory: Map<LiabilityCategory, number>;
  riskAssets: number;
  safeAssets: number;
  otherAssets: number;
  /** liabilities / assets, as a percentage. */
  debtRatio: number;
  /** Liabilities with a known original amount, shown as progress bars. */
  loans: LoanProgress[];
  /** Remaining liabilities, listed as plain balances. */
  plainLiabilities: { accountId: string; name: string; amount: number }[];
}

interface Summary {
  total: Totals;
  assetsByCategory: Map<AssetCategory, number>;
  liabilitiesByCategory: Map<LiabilityCategory, number>;
  byOwner: Record<Owner, Totals>;
  balanceByAccount: Map<string, number>;
}

function summarize(snapshot: Snapshot, accounts: Account[]): Summary {
  const total: Totals = { assets: 0, liabilities: 0, net: 0 };
  const byOwner: Record<Owner, Totals> = {
    self: { assets: 0, liabilities: 0, net: 0 },
    shared: { assets: 0, liabilities: 0, net: 0 },
  };
  const assetsByCategory = new Map<AssetCategory, number>();
  const liabilitiesByCategory = new Map<LiabilityCategory, number>();
  const balanceByAccount = new Map<string, number>();

  for (const b of snapshot.balances) {
    const account = accounts.find((a) => a.id === b.accountId);
    if (!account) continue;
    const owner = ownerOf(account);
    balanceByAccount.set(b.accountId, (balanceByAccount.get(b.accountId) || 0) + b.amount);

    if (account.type === "asset") {
      total.assets += b.amount;
      byOwner[owner].assets += b.amount;
      const cat = account.category as AssetCategory;
      assetsByCategory.set(cat, (assetsByCategory.get(cat) || 0) + b.amount);
    } else {
      total.liabilities += b.amount;
      byOwner[owner].liabilities += b.amount;
      const cat = account.category as LiabilityCategory;
      liabilitiesByCategory.set(cat, (liabilitiesByCategory.get(cat) || 0) + b.amount);
    }
  }

  total.net = total.assets - total.liabilities;
  for (const o of ["self", "shared"] as Owner[]) {
    byOwner[o].net = byOwner[o].assets - byOwner[o].liabilities;
  }
  return { total, assetsByCategory, liabilitiesByCategory, byOwner, balanceByAccount };
}

export function scopeAccounts(accounts: Account[], scope: Scope): Account[] {
  return scope === "all" ? accounts : accounts.filter((a) => ownerOf(a) === scope);
}

const ZERO: Totals = { assets: 0, liabilities: 0, net: 0 };

/** Derives every dashboard figure from the latest snapshot, plus the one before
 *  it for change indicators. `snapshots` must be sorted oldest-first. */
export function computeMetrics(
  accounts: Account[],
  snapshots: Snapshot[],
  scope: Scope = "all"
): Metrics {
  const latest = snapshots[snapshots.length - 1];
  const hasShared = accounts.some((a) => ownerOf(a) === "shared");

  if (!latest) {
    return {
      hasData: false,
      date: "",
      total: { ...ZERO },
      prev: null,
      prevDate: null,
      byOwner: { self: { ...ZERO }, shared: { ...ZERO } },
      hasShared,
      assetsByCategory: new Map(),
      liabilitiesByCategory: new Map(),
      riskAssets: 0,
      safeAssets: 0,
      otherAssets: 0,
      debtRatio: 0,
      loans: [],
      plainLiabilities: [],
    };
  }

  const scoped = scopeAccounts(accounts, scope);
  const cur = summarize(latest, scoped);
  const previous = snapshots[snapshots.length - 2];
  const prev = previous ? summarize(previous, scoped).total : null;
  // Owner split always covers every account, so the hero can show it in any scope.
  const ownerSplit = summarize(latest, accounts).byOwner;

  let riskAssets = 0;
  let safeAssets = 0;
  let otherAssets = 0;
  for (const [cat, amount] of cur.assetsByCategory) {
    if (RISK_CATEGORIES.includes(cat)) riskAssets += amount;
    else if (SAFE_CATEGORIES.includes(cat)) safeAssets += amount;
    else otherAssets += amount;
  }

  const loans: LoanProgress[] = [];
  const plainLiabilities: Metrics["plainLiabilities"] = [];
  for (const account of scoped) {
    if (account.type !== "liability") continue;
    const balance = cur.balanceByAccount.get(account.id) ?? 0;
    if (account.originalAmount) {
      const repaid = Math.max(0, account.originalAmount - balance);
      loans.push({
        accountId: account.id,
        name: account.name,
        balance,
        originalAmount: account.originalAmount,
        repaid,
        progress: Math.min(100, (repaid / account.originalAmount) * 100),
      });
    } else if (balance > 0) {
      plainLiabilities.push({ accountId: account.id, name: account.name, amount: balance });
    }
  }
  plainLiabilities.sort((a, b) => b.amount - a.amount);

  return {
    hasData: true,
    date: latest.date,
    total: cur.total,
    prev,
    prevDate: previous ? previous.date : null,
    byOwner: ownerSplit,
    hasShared,
    assetsByCategory: cur.assetsByCategory,
    liabilitiesByCategory: cur.liabilitiesByCategory,
    riskAssets,
    safeAssets,
    otherAssets,
    debtRatio: cur.total.assets > 0 ? (cur.total.liabilities / cur.total.assets) * 100 : 0,
    loans,
    plainLiabilities,
  };
}

/** Top categories by amount, with the tail folded into a single "その他" slice
 *  so the donut never exceeds MAX_SLICES + 1 wedges. */
export function toSlices(
  byCategory: Map<AssetCategory, number>,
  labels: Record<AssetCategory, string>
): Slice[] {
  const entries = [...byCategory.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const totalValue = entries.reduce((s, [, v]) => s + v, 0);
  if (totalValue <= 0) return [];

  const head = entries.slice(0, MAX_SLICES);
  const tail = entries.slice(MAX_SLICES);
  const slices: Slice[] = head.map(([cat, value]) => ({
    key: cat,
    label: labels[cat] ?? cat,
    value,
    share: (value / totalValue) * 100,
    color: CATEGORY_COLORS[cat],
  }));

  if (tail.length) {
    const rest = tail.reduce((s, [, v]) => s + v, 0);
    slices.push({
      key: "__other",
      label: `その他（${tail.length}件）`,
      value: rest,
      share: (rest / totalValue) * 100,
      color: CATEGORY_COLORS.other,
    });
  }
  return slices;
}

/** Per-snapshot totals for the trend chart. 純資産 and 負債 stack to 総資産. */
export function buildSeries(accounts: Account[], snapshots: Snapshot[]) {
  return snapshots.map((s) => {
    const { total } = summarize(s, accounts);
    return {
      date: s.date,
      label: s.date.slice(5).replace("-", "/"),
      純資産: total.net,
      負債: total.liabilities,
      総資産: total.assets,
    };
  });
}

/** Compact Japanese money: 億 / 万 / 円. */
export function yen(n: number): string {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 100_000_000) {
    const oku = Math.floor(v / 100_000_000);
    const man = Math.round((v - oku * 100_000_000) / 10_000);
    return man > 0 ? `${sign}${oku}億${man.toLocaleString()}万円` : `${sign}${oku}億円`;
  }
  if (v >= 10_000) return sign + Math.round(v / 10_000).toLocaleString() + "万円";
  return sign + Math.round(v).toLocaleString() + "円";
}

/** Short form for chart axes, where space is tight. */
export function yenAxis(n: number): string {
  const v = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (v >= 100_000_000) return sign + (v / 100_000_000).toFixed(1).replace(/\.0$/, "") + "億";
  if (v >= 10_000) return sign + Math.round(v / 10_000).toLocaleString() + "万";
  return sign + v.toLocaleString();
}

/** Signed variant for change indicators. */
export function yenDelta(n: number): string {
  if (n === 0) return "±0円";
  return (n > 0 ? "+" : "") + yen(n);
}

export function pct(n: number, digits = 1): string {
  return n.toFixed(digits) + "%";
}
