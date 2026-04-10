import { useState } from "react";
import type { Account, Holding, AssetCategory, LiabilityCategory } from "../types";
import { ASSET_CATEGORY_LABELS, LIABILITY_CATEGORY_LABELS, KNOWN_RETURNS, RETURN_CATEGORIES } from "../types";
import { saveAccount, deleteAccount } from "../db";

interface Props {
  accounts: Account[];
  onChanged: () => void;
}

const EMPTY_HOLDING: Holding = { id: "", name: "", expectedAnnualReturn: 0.08 };

export default function AccountsPage({ accounts, onChanged }: Props) {
  const [editing, setEditing] = useState<Account | null>(null);
  const [showForm, setShowForm] = useState(false);

  const assets = accounts.filter((a) => a.type === "asset");
  const liabilities = accounts.filter((a) => a.type === "liability");

  const startNew = (type: "asset" | "liability") => {
    setEditing({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: "",
      type,
      category: type === "asset" ? "bank" : "housing_loan",
      holdings: [],
    });
    setShowForm(true);
  };

  const startEdit = (account: Account) => {
    setEditing({ ...account, holdings: account.holdings ? [...account.holdings] : [] });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;
    const toSave = { ...editing };
    if (toSave.category !== "securities") {
      delete toSave.holdings;
    }
    await saveAccount(toSave);
    setShowForm(false);
    setEditing(null);
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この口座を削除しますか？")) return;
    await deleteAccount(id);
    onChanged();
  };

  const addHolding = () => {
    if (!editing) return;
    const h: Holding = { ...EMPTY_HOLDING, id: Math.random().toString(36).slice(2) + Date.now().toString(36) };
    setEditing({ ...editing, holdings: [...(editing.holdings || []), h] });
  };

  const updateHolding = (idx: number, field: keyof Holding, value: string | number) => {
    if (!editing?.holdings) return;
    const updated = [...editing.holdings];
    if (field === "name") {
      updated[idx] = { ...updated[idx], name: value as string };
      const known = KNOWN_RETURNS[value as string];
      if (known) updated[idx].expectedAnnualReturn = known;
    } else if (field === "expectedAnnualReturn") {
      updated[idx] = { ...updated[idx], expectedAnnualReturn: value as number };
    }
    setEditing({ ...editing, holdings: updated });
  };

  const removeHolding = (idx: number) => {
    if (!editing?.holdings) return;
    const updated = editing.holdings.filter((_, i) => i !== idx);
    setEditing({ ...editing, holdings: updated });
  };

  if (showForm && editing) {
    return (
      <div className="page">
        <h2>{editing.name ? "口座を編集" : "口座を追加"}</h2>
        <div className="form-group">
          <label>口座名</label>
          <input
            type="text"
            placeholder="例: 三菱UFJ銀行、SBI証券"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>カテゴリ</label>
          <select
            value={editing.category}
            onChange={(e) => setEditing({ ...editing, category: e.target.value as AssetCategory | LiabilityCategory })}
          >
            {editing.type === "asset"
              ? Object.entries(ASSET_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))
              : Object.entries(LIABILITY_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
          </select>
        </div>

        {editing.category === "securities" && (
          <div className="holdings-section">
            <h3>保有銘柄</h3>
            {editing.holdings?.map((h, idx) => (
              <div key={h.id || idx} className="holding-row">
                <input
                  type="text"
                  placeholder="銘柄名 (例: SP500)"
                  value={h.name}
                  onChange={(e) => updateHolding(idx, "name", e.target.value)}
                />
                <div className="return-input">
                  <label>想定年利</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="10"
                    defaultValue={(h.expectedAnnualReturn * 100).toString()}
                    onBlur={(e) => updateHolding(idx, "expectedAnnualReturn", parseFloat(e.target.value) / 100 || 0)}
                  />
                  <span>%</span>
                </div>
                <button className="btn-icon" onClick={() => removeHolding(idx)}>✕</button>
              </div>
            ))}
            <button className="btn-secondary" onClick={addHolding}>+ 銘柄を追加</button>
          </div>
        )}

        {RETURN_CATEGORIES.includes(editing.category as AssetCategory) && (
          <div className="form-group">
            <label>想定年利</label>
            <div className="return-input">
              <input
                type="text"
                inputMode="decimal"
                placeholder="6"
                defaultValue={editing.expectedAnnualReturn ? (editing.expectedAnnualReturn * 100).toString() : ""}
                onBlur={(e) => setEditing({ ...editing, expectedAnnualReturn: parseFloat(e.target.value) / 100 || 0 })}
              />
              <span>%</span>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null); }}>キャンセル</button>
          <button className="btn-primary" onClick={handleSave} disabled={!editing.name.trim()}>保存</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <section>
        <h2>資産口座</h2>
        {assets.map((a) => (
          <div key={a.id} className="account-card" onClick={() => startEdit(a)}>
            <div className="account-info">
              <span className="account-name">{a.name}</span>
              <span className="account-category">
                {ASSET_CATEGORY_LABELS[a.category as AssetCategory]}
                {a.holdings && a.holdings.length > 0 && ` (${a.holdings.map((h) => h.name).join(", ")})`}
              </span>
            </div>
            <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}>✕</button>
          </div>
        ))}
        <button className="btn-add" onClick={() => startNew("asset")}>＋ 資産口座を追加</button>
      </section>

      <section>
        <h2>負債</h2>
        {liabilities.map((a) => (
          <div key={a.id} className="account-card" onClick={() => startEdit(a)}>
            <div className="account-info">
              <span className="account-name">{a.name}</span>
              <span className="account-category">{LIABILITY_CATEGORY_LABELS[a.category as LiabilityCategory]}</span>
            </div>
            <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}>✕</button>
          </div>
        ))}
        <button className="btn-add" onClick={() => startNew("liability")}>＋ 負債を追加</button>
      </section>
    </div>
  );
}
