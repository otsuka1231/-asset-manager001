import { useState } from "react";
import type { Account, Holding, AssetCategory, LiabilityCategory, Owner } from "../types";
import { ASSET_CATEGORY_LABELS, LIABILITY_CATEGORY_LABELS, OWNER_LABELS, ownerOf } from "../types";
import { saveAccount, deleteAccount } from "../db";
import FundCombobox from "../components/FundCombobox";

interface Props {
  accounts: Account[];
  onChanged: () => void;
}

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
      owner: "self",
      holdings: [],
    });
    setShowForm(true);
  };

  const startEdit = (account: Account) => {
    setEditing({ ...account, owner: ownerOf(account), holdings: account.holdings ? [...account.holdings] : [] });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;
    const toSave = { ...editing };
    if (toSave.category !== "securities") {
      delete toSave.holdings;
    }
    if (toSave.type !== "liability") {
      delete toSave.originalAmount;
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
    const h: Holding = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), name: "" };
    setEditing({ ...editing, holdings: [...(editing.holdings || []), h] });
  };

  const updateHolding = (idx: number, name: string) => {
    if (!editing?.holdings) return;
    const updated = [...editing.holdings];
    updated[idx] = { ...updated[idx], name };
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
          <label>名義</label>
          <div className="owner-toggle">
            {(Object.keys(OWNER_LABELS) as Owner[]).map((o) => (
              <button
                key={o}
                type="button"
                className={ownerOf(editing) === o ? "active" : ""}
                onClick={() => setEditing({ ...editing, owner: o })}
              >
                {OWNER_LABELS[o]}
              </button>
            ))}
          </div>
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

        {editing.type === "liability" && (
          <div className="form-group">
            <label>当初借入額（任意）</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="例: 40,000,000"
              defaultValue={editing.originalAmount ? editing.originalAmount.toLocaleString() : ""}
              onBlur={(e) => {
                const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                setEditing({ ...editing, originalAmount: Number.isFinite(n) && n > 0 ? n : undefined });
              }}
            />
            <p className="field-hint">入力すると返済の進捗が表示されます。</p>
          </div>
        )}

        {editing.category === "securities" && (
          <div className="holdings-section">
            <h3>保有銘柄</h3>
            {editing.holdings?.map((h, idx) => (
              <div key={h.id || idx} className="holding-row">
                <FundCombobox value={h.name} onChange={(v) => updateHolding(idx, v)} />
                <button className="btn-icon" onClick={() => removeHolding(idx)}>✕</button>
              </div>
            ))}
            <button className="btn-secondary" onClick={addHolding}>+ 銘柄を追加</button>
          </div>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null); }}>キャンセル</button>
          <button className="btn-primary" onClick={handleSave} disabled={!editing.name.trim()}>保存</button>
        </div>
      </div>
    );
  }

  const renderCard = (a: Account, sub: string) => (
    <div key={a.id} className="account-card" onClick={() => startEdit(a)}>
      <div className="account-info">
        <span className="account-name">
          {a.name}
          {ownerOf(a) === "shared" && <span className="owner-badge">{OWNER_LABELS.shared}</span>}
        </span>
        <span className="account-category">{sub}</span>
      </div>
      <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}>✕</button>
    </div>
  );

  return (
    <div className="page">
      <section>
        <h2>資産口座</h2>
        {assets.map((a) =>
          renderCard(
            a,
            ASSET_CATEGORY_LABELS[a.category as AssetCategory] +
              (a.holdings && a.holdings.length > 0 ? ` (${a.holdings.map((h) => h.name).join(", ")})` : "")
          )
        )}
        <button className="btn-add" onClick={() => startNew("asset")}>＋ 資産口座を追加</button>
      </section>

      <section>
        <h2>負債</h2>
        {liabilities.map((a) => renderCard(a, LIABILITY_CATEGORY_LABELS[a.category as LiabilityCategory]))}
        <button className="btn-add" onClick={() => startNew("liability")}>＋ 負債を追加</button>
      </section>
    </div>
  );
}
