import { ReferenceAsset } from '../types';

const DB_NAME = 'EpicTimelineDB';
const ASSET_STORE = 'referenceAssets';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
};

export const saveReferenceAsset = async (asset: ReferenceAsset): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readwrite');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.add(asset);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

export const getAllReferenceAssets = async (): Promise<ReferenceAsset[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readonly');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as ReferenceAsset[]);
    request.onerror = () => reject(request.error);
  });
};

export const deleteReferenceAsset = async (id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readwrite');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
