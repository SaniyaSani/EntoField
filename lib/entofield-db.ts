import type { AppState, PhotoMeta } from "./types";

const DB_NAME = "entofield";
const DB_VERSION = 1;
const STATE_STORE = "state";
const PHOTO_STORE = "photos";
const STATE_KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE);
      }
      if (!database.objectStoreNames.contains(PHOTO_STORE)) {
        database.createObjectStore(PHOTO_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<AppState | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STATE_STORE, "readonly");
  const result = await requestResult(
    transaction.objectStore(STATE_STORE).get(STATE_KEY),
  );
  database.close();
  return (result as AppState | undefined) ?? null;
}

export async function saveState(state: AppState): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STATE_STORE, "readwrite");
  transaction.objectStore(STATE_STORE).put(state, STATE_KEY);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function savePhoto(meta: PhotoMeta, blob: Blob): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(PHOTO_STORE, "readwrite");
  transaction.objectStore(PHOTO_STORE).put({ meta, blob }, meta.id);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function getPhotoBlob(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const transaction = database.transaction(PHOTO_STORE, "readonly");
  const result = (await requestResult(
    transaction.objectStore(PHOTO_STORE).get(id),
  )) as { blob?: Blob } | undefined;
  database.close();
  return result?.blob ?? null;
}

export async function deletePhoto(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(PHOTO_STORE, "readwrite");
  transaction.objectStore(PHOTO_STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function clearAllData(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STATE_STORE, PHOTO_STORE],
    "readwrite",
  );
  transaction.objectStore(STATE_STORE).clear();
  transaction.objectStore(PHOTO_STORE).clear();
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
