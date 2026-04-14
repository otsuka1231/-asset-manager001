import { useState, useEffect } from "react";
import type { Account, Snapshot, BalanceEntry } from "../types";
import { getSnapshots, saveSnapshot } from "../db";

const STORAGE_KEY = "record_draft";

interface Props {
  accounts: Account[];
  onSaved: () => void;
}

function loadDraft(): { balances: Record<string, number>; date: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(balances: Record<string, number>, date: string) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ balances, date }));
}

function clearDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export default function RecordPage({ accounts, onSaved }: Props) {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loaded, setLoaded] = useState(false);

  // Load: draft first, then fall back to latest snapshot
  useEffect(() => {
    (async () => {
      const draft = loadDraft();
      if (draft) {
        setBalances(draft.balances);
        setDate(draft.date);
        setLoaded(true);
        return;
      }
      const snapshots = await getSnapshots();
      if (snapshots.length === 0) { setLoaded(true); return; }
      // Use the most recently SAVED snapshot (not latest by date).
      // Fall back to date for legacy snapshots that lack savedAt.
      const latest = [...snapshots].sort((a, b) => {
        const sa = a.savedAt ?? 0;
        const sb = b.savedAt ?? 0;
        if (sa !== sb) return sb - sa;
        return b.date.localeCompare(a.date);
      })[0];
      const defaults: Record<string, number> = {};
      for (const b of latest.balances) {
        const key = b.holdingId ? `${b.accountId}:${b.holdingId}` : b.accountId;
        defaults[key] = b.amount;
      }
      setBalances(defaults);
      setLoaded(true);
    })();
  }, []);

  // Auto-save draft on every change
  useEffect(() => {
    if (loaded) saveDraft(balances, date);
  }, [balances, date, loaded]);

  const updateBalance = (key: string, value: string) => {
    const num = value === "" ? 0 : parseInt(value.replace(/,/g, ""), 10) || 0;
    setBalances((prev) => ({ ...prev, [key]: num }));
  };

  const handleSave = async () => {
    setSaving(true);
    const entries: BalanceEntry[] = [];
    for (const account of accounts) {
      if (account.category === "securities" && account.holdings?.length) {
        for (const h of account.holdings) {
          const key = `${account.id}:${h.id}`;
          entries.push({ accountId: account.id, holdingId: h.id, amount: balances[key] || 0 });
        }
      } else {
        entries.push({ accountId: account.id, amount: balances[account.id] || 0 });
      }
    }

    const snapshot: Snapshot = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      date,
      balances: entries,
      savedAt: Date.now(),
    };
    await saveSnapshot(snapshot);
    clearDraft();
    setSaving(false);
    onSaved();
  };

  const assets = accounts.filter((a) => a.type === "asset");
  const liabilities = accounts.filter((a) => a.type === "liability");

  const formatNum = (n: number) => n.toLocaleString();

  if (accounts.length === 0) {
    return (
      <div className="page">
        <p className="empty-text">まず「口座」タブから口座を登録してください。</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="form-group">
        <label>記録日</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {assets.length > 0 && <h2>資産</h2>}
      {assets.map((account) => (
        <div key={account.id} className="record-section">
          <h3 className="record-account-name">{account.name}</h3>
          {account.category === "securities" && account.holdings?.length ? (
            account.holdings.map((h) => {
              const key = `${account.id}:${h.id}`;
              return (
                <div key={h.id} className="record-row">
                  <label>{h.name}</label>
                  <div className="amount-input">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={balances[key] ? formatNum(balances[key]) : ""}
                      placeholder="0"
                      onChange={(e) => updateBalance(key, e.target.value)}
                    />
                    <span>円</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="record-row">
              <label>残高</label>
              <div className="amount-input">
                <input
                  type="text"
                  inputMode="numeric"
                  value={balances[account.id] ? formatNum(balances[account.id]) : ""}
                  placeholder="0"
                  onChange={(e) => updateBalance(account.id, e.target.value)}
                />
                <span>円</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {liabilities.length > 0 && <h2>負債</h2>}
      {liabilities.map((account) => (
        <div key={account.id} className="record-section">
          <h3 className="record-account-name">{account.name}</h3>
          <div className="record-row">
            <label>残高</label>
            <div className="amount-input">
              <input
                type="text"
                inputMode="numeric"
                value={balances[account.id] ? formatNum(balances[account.id]) : ""}
                placeholder="0"
                onChange={(e) => updateBalance(account.id, e.target.value)}
              />
              <span>円</span>
            </div>
          </div>
        </div>
      ))}

      <button className="btn-primary full-width" onClick={handleSave} disabled={saving}>
        {saving ? "保存中..." : "記録する"}
      </button>
    </div>
  );
}
