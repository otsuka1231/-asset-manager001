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

export interface Holding {
  id: string;
  name: string; // e.g. "SP500", "全世界株式"
  expectedAnnualReturn: number; // e.g. 0.10 for 10%
}

export interface Account {
  id: string;
  name: string; // e.g. "三菱UFJ銀行", "SBI証券"
  type: "asset" | "liability";
  category: AssetCategory | LiabilityCategory;
  holdings?: Holding[]; // only for securities
  expectedAnnualReturn?: number; // for non-securities with returns (e.g. WealthNavi)
}

// Categories that can have an expected annual return
export const RETURN_CATEGORIES: AssetCategory[] = ["wealthnavi", "crypto", "other"];

export interface BalanceEntry {
  accountId: string;
  holdingId?: string; // for securities
  amount: number;
}

export interface Snapshot {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  balances: BalanceEntry[];
}

export interface GoalConfig {
  targetAmount: number;
  targetDate: string; // ISO date
  birthDate: string;
}

export const DEFAULT_GOAL: GoalConfig = {
  targetAmount: 200_000_000,
  targetDate: "2041-12-31",
  birthDate: "1991-12-31",
};

// Well-known expected returns
export const KNOWN_RETURNS: Record<string, number> = {
  "SP500": 0.10,
  "S&P500": 0.10,
  "全世界株式": 0.08,
  "オルカン": 0.08,
  "先進国株式": 0.08,
  "NASDAQ": 0.12,
  "日経平均": 0.06,
  "TOPIX": 0.06,
  "新興国株式": 0.07,
};
