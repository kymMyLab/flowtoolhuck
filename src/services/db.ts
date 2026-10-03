import { ReferenceAsset } from '../types';

export interface StoryRecord {
  id?: number;
  titleJp: string;
  titleEn: string;
  country: string;
  era: string;
  theme: string;
  protagonistSummary: string;
  createdAt: string;
  metadata?: string;
}

const DB_NAME = 'EpicTimelineDB';
const STORE_NAME = 'storyArchive';
const ASSET_STORE = 'referenceAssets';
const DB_VERSION = 2; // バージョンアップ

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
        // Story Archive
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('era', 'era', { unique: false });
          store.createIndex('theme', 'theme', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        // Reference Assets (New in V2)
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
};

export const saveStory = async (story: StoryRecord): Promise<number | null> => {
  if (!story.titleJp || story.titleJp.trim() === '' || story.titleJp === 'undefined') {
    return null;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(story);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

export const getAllStories = async (): Promise<StoryRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const result = (request.result as StoryRecord[]).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
};

// Reference Asset Methods
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