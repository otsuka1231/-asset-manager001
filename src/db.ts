import type { Account, Snapshot, GoalConfig } from "./types";
import { DEFAULT_GOAL } from "./types";

const DB_NAME = "asset-manager";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("accounts")) {
        db.createObjectStore("accounts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Accounts
export async function getAccounts(): Promise<Account[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("accounts", "readonly");
    const req = tx.objectStore("accounts").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAccount(account: Account): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("accounts", "readwrite");
    tx.objectStore("accounts").put(account);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("accounts", "readwrite");
    tx.objectStore("accounts").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Snapshots
export async function getSnapshots(): Promise<Snapshot[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readonly");
    const req = tx.objectStore("snapshots").getAll();
    req.onsuccess = () => {
      const snapshots = req.result as Snapshot[];
      snapshots.sort((a, b) => a.date.localeCompare(b.date));
      resolve(snapshots);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Goal config
export async function getGoal(): Promise<GoalConfig> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readonly");
    const req = tx.objectStore("settings").get("goal");
    req.onsuccess = () => resolve(req.result?.value ?? DEFAULT_GOAL);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGoal(goal: GoalConfig): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ key: "goal", value: goal });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Export / Import
export async function exportAll(): Promise<string> {
  const [accounts, snapshots, goal] = await Promise.all([
    getAccounts(),
    getSnapshots(),
    getGoal(),
  ]);
  return JSON.stringify({ accounts, snapshots, goal }, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["accounts", "snapshots", "settings"], "readwrite");
    if (data.accounts) {
      const store = tx.objectStore("accounts");
      for (const a of data.accounts) store.put(a);
    }
    if (data.snapshots) {
      const store = tx.objectStore("snapshots");
      for (const s of data.snapshots) store.put(s);
    }
    if (data.goal) {
      tx.objectStore("settings").put({ key: "goal", value: data.goal });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
