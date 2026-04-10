import { useState, useEffect, useCallback } from "react";
import type { Account, Snapshot, GoalConfig } from "./types";
import { DEFAULT_GOAL } from "./types";
import { getAccounts, getSnapshots, getGoal } from "./db";
import DashboardPage from "./pages/DashboardPage";
import RecordPage from "./pages/RecordPage";
import AccountsPage from "./pages/AccountsPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

type Tab = "dashboard" | "record" | "accounts" | "settings";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [goal, setGoal] = useState<GoalConfig>(DEFAULT_GOAL);
  const [tab, setTab] = useState<Tab>(() => {
    return (sessionStorage.getItem("currentTab") as Tab) || "dashboard";
  });

  const changeTab = (t: Tab) => {
    sessionStorage.setItem("currentTab", t);
    setTab(t);
  };

  const reload = useCallback(async () => {
    const [a, s, g] = await Promise.all([getAccounts(), getSnapshots(), getGoal()]);
    setAccounts(a);
    setSnapshots(s);
    setGoal(g);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>資産管理</h1>
      </header>

      <main className="app-main">
        {tab === "dashboard" && <DashboardPage accounts={accounts} snapshots={snapshots} goal={goal} />}
        {tab === "record" && <RecordPage accounts={accounts} onSaved={() => { reload(); changeTab("dashboard"); }} />}
        {tab === "accounts" && <AccountsPage accounts={accounts} onChanged={reload} />}
        {tab === "settings" && <SettingsPage goal={goal} onChanged={reload} />}
      </main>

      <nav className="tab-bar">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => changeTab("dashboard")}>
          <svg className="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-5h4v5a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>
          ホーム
        </button>
        <button className={tab === "record" ? "active" : ""} onClick={() => changeTab("record")}>
          <svg className="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          記録
        </button>
        <button className={tab === "accounts" ? "active" : ""} onClick={() => changeTab("accounts")}>
          <svg className="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20"/><path d="M2 15h20"/><path d="M9 3v18"/></svg>
          口座
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => changeTab("settings")}>
          <svg className="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"/></svg>
          設定
        </button>
      </nav>
    </div>
  );
}
