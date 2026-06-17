import { useState, useEffect, useCallback } from "react";
import type { Account, Snapshot } from "./types";
import { getAccounts, getSnapshots } from "./db";
import DashboardPage from "./pages/DashboardPage";
import RecordPage from "./pages/RecordPage";
import AccountsPage from "./pages/AccountsPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

type Tab = "dashboard" | "record" | "accounts" | "settings";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [tab, setTab] = useState<Tab>(() => {
    return (sessionStorage.getItem("currentTab") as Tab) || "dashboard";
  });

  const changeTab = (t: Tab) => {
    sessionStorage.setItem("currentTab", t);
    setTab(t);
  };

  const reload = useCallback(async () => {
    const [a, s] = await Promise.all([getAccounts(), getSnapshots()]);
    setAccounts(a);
    setSnapshots(s);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="app">
      <header className="app-header">
        <img className="header-mascot" src="nyasper/sit.png" alt="" aria-hidden="true" />
        <h1>資産管理</h1>
      </header>

      <main className="app-main">
        {tab === "dashboard" && <DashboardPage accounts={accounts} snapshots={snapshots} />}
        {tab === "record" && <RecordPage accounts={accounts} onSaved={() => { reload(); changeTab("dashboard"); }} />}
        {tab === "accounts" && <AccountsPage accounts={accounts} onChanged={reload} />}
        {tab === "settings" && <SettingsPage snapshots={snapshots} onChanged={reload} />}
      </main>

      <nav className="tab-bar">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => changeTab("dashboard")}>
          <img className="tab-mascot" src="nyasper/face.png" alt="" aria-hidden="true" />
          ホーム
        </button>
        <button className={tab === "record" ? "active" : ""} onClick={() => changeTab("record")}>
          <img className="tab-mascot" src="nyasper/lolli.png" alt="" aria-hidden="true" />
          記録
        </button>
        <button className={tab === "accounts" ? "active" : ""} onClick={() => changeTab("accounts")}>
          <img className="tab-mascot" src="nyasper/hearts.png" alt="" aria-hidden="true" />
          口座
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => changeTab("settings")}>
          <img className="tab-mascot" src="nyasper/zen.png" alt="" aria-hidden="true" />
          設定
        </button>
      </nav>
    </div>
  );
}
