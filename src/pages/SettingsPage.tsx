import { useState } from "react";
import type { GoalConfig } from "../types";
import { saveGoal, exportAll, importAll } from "../db";

interface Props {
  goal: GoalConfig;
  onChanged: () => void;
}

export default function SettingsPage({ goal, onChanged }: Props) {
  const [form, setForm] = useState<GoalConfig>(goal);
  const [saved, setSaved] = useState(false);

  const handleSaveGoal = async () => {
    await saveGoal(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onChanged();
  };

  const handleExport = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asset-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await importAll(text);
      onChanged();
      alert("データを復元しました！");
    } catch {
      alert("ファイルの読み込みに失敗しました");
    }
  };

  return (
    <div className="page">
      <h2>目標設定</h2>
      <div className="form-group">
        <label>目標金額（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={form.targetAmount.toLocaleString()}
          onChange={(e) => setForm({ ...form, targetAmount: parseInt(e.target.value.replace(/,/g, ""), 10) || 0 })}
        />
      </div>
      <div className="form-group">
        <label>目標達成日</label>
        <input
          type="date"
          value={form.targetDate}
          onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>生年月日</label>
        <input
          type="date"
          value={form.birthDate}
          onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
        />
      </div>
      <button className="btn-primary full-width" onClick={handleSaveGoal}>
        {saved ? "保存しました！" : "目標を保存"}
      </button>

      <hr className="divider" />

      <h2>データ管理</h2>
      <p className="help-text">バックアップのエクスポート・インポートができます。</p>
      <div className="settings-actions">
        <button className="btn-secondary" onClick={handleExport}>バックアップ保存</button>
        <label className="btn-secondary">
          バックアップ復元
          <input type="file" accept=".json" onChange={handleImport} hidden />
        </label>
      </div>
    </div>
  );
}
