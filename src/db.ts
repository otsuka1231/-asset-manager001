import type { Account, Snapshot } from "./types";

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
      // Sort by date, then by save time. Without the savedAt tie-break, two
      // records on the same date fall back to IndexedDB's key order (a random
      // id), so the dashboard could pick the OLDER one as "latest".
      snapshots.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return (a.savedAt ?? 0) - (b.savedAt ?? 0);
      });
      resolve(snapshots);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Saves a snapshot, replacing any existing record for the same date so a
 *  given day always has exactly one entry. */
export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    const store = tx.objectStore("snapshots");
    const req = store.getAll();
    req.onsuccess = () => {
      for (const s of req.result as Snapshot[]) {
        if (s.date === snapshot.date && s.id !== snapshot.id) store.delete(s.id);
      }
      store.put(snapshot);
    };
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

// Export / Import
export async function exportAll(): Promise<string> {
  const [accounts, snapshots] = await Promise.all([
    getAccounts(),
    getSnapshots(),
  ]);
  return JSON.stringify({ accounts, snapshots }, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["accounts", "snapshots"], "readwrite");
    if (data.accounts) {
      const store = tx.objectStore("accounts");
      for (const a of data.accounts) store.put(a);
    }
    if (data.snapshots) {
      const store = tx.objectStore("snapshots");
      for (const s of data.snapshots) store.put(s);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
