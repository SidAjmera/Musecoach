import { Profile, Session, defaultProfile } from "./types";
import { forgetAIConnection } from "./ai-settings";
import { exerciseKinds } from "./exercises";
const DB = "musecoach-v1";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("sessions", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          "Local history is unavailable. Check browser storage permissions.",
        ),
      );
    r.onblocked = () =>
      reject(new Error("Close other Musecoach tabs and retry."));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", mode);
    const request = run(tx.objectStore("sessions"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(
        new Error(
          "Could not save local history. Your browser storage may be full or disabled.",
        ),
      );
    };
    tx.onabort = tx.onerror;
  });
}
export function readProfile(): Profile | null {
  const raw = localStorage.getItem("musecoach-profile");
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p.name !== "string" || !Array.isArray(p.goals)) return null;
    const favorites = Array.isArray(p.favoriteExercises)
      ? p.favoriteExercises.filter((kind: unknown) =>
          exerciseKinds.includes(kind as (typeof exerciseKinds)[number]),
        )
      : [];
    return {
      ...defaultProfile,
      ...p,
      favoriteExercises: [...new Set(favorites)],
    };
  } catch {
    return null;
  }
}
export function saveProfile(p: Profile) {
  localStorage.setItem("musecoach-profile", JSON.stringify(p));
}
export async function saveSession(session: Session, audio?: Blob) {
  await transaction("readwrite", (s) =>
    s.put({ ...session, audioSaved: !!audio, audio }),
  );
}
export async function restoreSessionHistory(
  incoming: Session[],
): Promise<{ added: number; skipped: number }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const keys = store.getAllKeys();
    let added = 0,
      skipped = 0;
    keys.onsuccess = () => {
      const existing = new Set(keys.result);
      for (const session of incoming) {
        if (existing.has(session.id)) {
          skipped++;
          continue;
        }
        store.put({ ...session, audioSaved: false, restored: true });
        existing.add(session.id);
        added++;
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve({ added, skipped });
    };
    const fail = () => {
      db.close();
      reject(
        new Error(
          "Could not restore this history. Check browser storage permissions or available space. Existing sessions were kept.",
        ),
      );
    };
    tx.onerror = fail;
    tx.onabort = fail;
  });
}
export async function listSessions(): Promise<Session[]> {
  const records = await transaction<(Session & { audio?: Blob })[]>(
    "readonly",
    (s) => s.getAll(),
  );
  return records
    .map(({ audio, ...session }) => {
      void audio;
      return session;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
export async function getAudio(id: string): Promise<Blob | undefined> {
  const r = await transaction<(Session & { audio?: Blob }) | undefined>(
    "readonly",
    (s) => s.get(id),
  );
  return r?.audio;
}
export async function deleteSession(id: string) {
  await transaction("readwrite", (s) => s.delete(id));
}
export async function deleteAudio(id: string) {
  const r = await transaction<(Session & { audio?: Blob }) | undefined>(
    "readonly",
    (s) => s.get(id),
  );
  if (r) {
    delete r.audio;
    r.audioSaved = false;
    await transaction("readwrite", (s) => s.put(r));
  }
}
export async function clearData() {
  forgetAIConnection();
  await transaction("readwrite", (s) => s.clear());
  localStorage.removeItem("musecoach-profile");
  localStorage.removeItem("musecoach-chat");
  localStorage.removeItem("musecoach-designed-exercise");
}
