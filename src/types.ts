export type AssetCategory =
  | "cash"
  | "bank"
  | "securities"
  | "insurance"
  | "land"
  | "crypto"
  | "wealthnavi"
  | "other";

export type LiabilityCategory = "housing_loan" | "bank_loan" | "other_loan";

export type Owner = "self" | "shared";

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  cash: "現金",
  bank: "銀行預貯金",
  securities: "証券口座",
  insurance: "生命保険",
  land: "土地",
  crypto: "仮想通貨",
  wealthnavi: "WealthNavi",
  other: "その他",
};

export const LIABILITY_CATEGORY_LABELS: Record<LiabilityCategory, string> = {
  housing_loan: "住宅ローン",
  bank_loan: "銀行借入",
  other_loan: "その他借入",
};

export const OWNER_LABELS: Record<Owner, string> = {
  self: "本人",
  shared: "共有",
};

export interface Holding {
  id: string;
  name: string; // official fund / stock name
}

// Searchable master list of common funds. `keywords` lets casual terms
// ("オルカン", "SP500", "VTI"...) surface the official name.
export interface FundOption {
  name: string;
  keywords: string;
}

export const FUND_OPTIONS: FundOption[] = [
  { name: "eMAXIS Slim 全世界株式（オール・カントリー）", keywords: "オルカン ぜんせかい all country emaxis イーマクシス" },
  { name: "eMAXIS Slim 全世界株式（除く日本）", keywords: "オルカン 除く日本 emaxis" },
  { name: "eMAXIS Slim 米国株式（S&P500）", keywords: "sp500 s&p500 エスピー 米国 べいこく emaxis スリム" },
  { name: "eMAXIS Slim 先進国株式インデックス", keywords: "先進国 せんしんこく emaxis" },
  { name: "eMAXIS Slim 新興国株式インデックス", keywords: "新興国 しんこうこく emaxis" },
  { name: "eMAXIS Slim 国内株式（TOPIX）", keywords: "topix トピックス 国内 emaxis" },
  { name: "eMAXIS Slim 国内株式（日経平均）", keywords: "日経 nikkei 225 国内 emaxis" },
  { name: "eMAXIS Slim バランス（8資産均等型）", keywords: "バランス 8資産 均等 emaxis" },
  { name: "楽天・全米株式インデックス・ファンド（楽天・VTI）", keywords: "vti 楽天 らくてん 全米 ぜんべい" },
  { name: "楽天・全世界株式インデックス・ファンド（楽天・VT）", keywords: "vt 楽天 全世界 オルカン" },
  { name: "楽天・S&P500インデックス・ファンド", keywords: "sp500 s&p500 楽天 米国" },
  { name: "楽天・オールカントリー株式インデックス・ファンド", keywords: "オルカン all country 楽天" },
  { name: "楽天・NASDAQ-100インデックス・ファンド", keywords: "nasdaq ナスダック 100 楽天" },
  { name: "SBI・V・S&P500インデックス・ファンド", keywords: "sp500 s&p500 sbi voo 米国" },
  { name: "SBI・V・全米株式インデックス・ファンド", keywords: "vti sbi 全米" },
  { name: "SBI・V・全世界株式インデックス・ファンド", keywords: "vt sbi 全世界 オルカン" },
  { name: "SBI・先進国株式インデックス・ファンド（雪だるま）", keywords: "先進国 雪だるま sbi" },
  { name: "ニッセイ外国株式インデックスファンド", keywords: "ニッセイ 外国 先進国 msciコクサイ" },
  { name: "ニッセイNASDAQ100インデックスファンド", keywords: "nasdaq ナスダック ニッセイ 100" },
  { name: "たわらノーロード 先進国株式", keywords: "たわら 先進国 ノーロード" },
  { name: "iFreeNEXT NASDAQ100インデックス", keywords: "nasdaq ナスダック ifree アイフリー 100" },
  { name: "iFreeNEXT FANG+インデックス", keywords: "fang ファング ifree" },
  { name: "インベスコ QQQ", keywords: "qqq nasdaq ナスダック invesco" },
  { name: "ひふみプラス", keywords: "ひふみ hifumi" },
  { name: "セゾン・グローバルバランスファンド", keywords: "セゾン バランス global" },
];

export interface Account {
  id: string;
  name: string; // e.g. "三菱UFJ銀行", "SBI証券"
  type: "asset" | "liability";
  category: AssetCategory | LiabilityCategory;
  owner?: Owner; // 本人 or 共有 (defaults to "self" for legacy data)
  holdings?: Holding[]; // only for securities
}

/** Owner of an account, defaulting legacy accounts (no owner field) to "self". */
export function ownerOf(account: Account): Owner {
  return account.owner ?? "self";
}

export interface BalanceEntry {
  accountId: string;
  holdingId?: string; // for securities
  amount: number;
}

export interface Snapshot {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  balances: BalanceEntry[];
  savedAt?: number; // epoch ms when the snapshot was saved
}
