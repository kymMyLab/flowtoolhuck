export function safeJsonParse<T>(raw: any, defaultValue: T = {} as T): T {
  if (!raw) return defaultValue;
  if (typeof raw === 'object' && raw !== null && !('text' in raw)) {
    return raw as T;
  }
  let text = '';
  if (typeof raw === 'string') {
    text = raw;
  } else if (typeof raw === 'object' && raw !== null && typeof raw.text === 'string') {
    text = raw.text;
  } else {
    try {
      text = String(raw);
    } catch {
      return defaultValue;
    }
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return defaultValue;
  }
  const cleanText = text.replace(/```json\n?|```/g, '').trim();
  const firstBrace = cleanText.indexOf('{');
  const firstBracket = cleanText.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) {
    return defaultValue;
  }
  try {
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      const lastBracket = cleanText.lastIndexOf(']');
      if (lastBracket > firstBracket) {
        const jsonStr = cleanText.slice(firstBracket, lastBracket + 1);
        return JSON.parse(jsonStr) as T;
      }
    }
    if (firstBrace !== -1) {
      const lastBrace = cleanText.lastIndexOf('}');
      if (lastBrace > firstBrace) {
        const jsonStr = cleanText.slice(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr) as T;
      }
    }
  } catch (err) {
    console.warn('JSON Parse Error:', err);
  }
  return defaultValue;
}
export function formatErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  
  const parts: string[] = [];
  if (err?.status) parts.push(`[Status ${err.status}]`);
  if (err?.code) parts.push(`[Code ${err.code}]`);
  
  const mainMsg = err?.error?.message || err?.message || err?.statusText;
  if (mainMsg) parts.push(String(mainMsg));
  if (err?.error && typeof err.error === 'string') parts.push(err.error);
  if (err?.details) {
    try {
      const detailsStr = typeof err.details === 'string' ? err.details : JSON.stringify(err.details);
      parts.push(`(Details: ${detailsStr})`);
    } catch (_) {}
  }
  
  if (parts.length > 0) return parts.join(' ');
  
  try {
    const json = JSON.stringify(err);
    if (json && json !== '{}') return json;
  } catch (_) {}
  
  return String(err);
}
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = '処理'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}がタイムアウト（${Math.round(timeoutMs / 1000)}秒経過）しました`)), timeoutMs)
    )
  ]);
}
export interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  timeoutLabel?: string;
  superBackoff?: boolean;
  abortCheck?: () => boolean;
}
export function formatDurationMs(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.round(ms / 60000);
    return `${mins}分間`;
  }
  return `${Math.round(ms / 1000)}秒`;
}
export async function sleepWithAbortCheck(durationMs: number, abortCheck?: () => boolean): Promise<boolean> {
  if (durationMs <= 0) return true;
  return new Promise((resolve) => {
    if (abortCheck && abortCheck()) {
      return resolve(false);
    }
    
    let timer: any;
    let timeout: any;
    
    const cleanup = () => {
      if (timer) clearInterval(timer);
      if (timeout) clearTimeout(timeout);
    };
    timer = setInterval(() => {
      if (abortCheck && abortCheck()) {
        cleanup();
        resolve(false);
      }
    }, 100);
    timeout = setTimeout(() => {
      cleanup();
      resolve(true);
    }, durationMs);
  });
}
/** 
 * 軽快なスマート・リトライ＆同時衝突防止ジッター
 * standardDelays: [8000, 18000, 30000] (最大3回)
 * throttleDelays: [15000, 30000, 45000]
 * jitter: 5000 + Math.random() * 15000
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number, err: any, isSuperBackoff?: boolean) => void,
  maxRetriesOrOptions: number | RetryOptions = 3,
  timeoutMs?: number,
  timeoutLabel = 'API呼び出し',
  superBackoff = false,
  abortCheck?: () => boolean
): Promise<T> {
  let maxRetries = 3;
  let effectiveTimeoutMs = timeoutMs;
  let effectiveTimeoutLabel = timeoutLabel;
  let effectiveAbortCheck = abortCheck;
  if (typeof maxRetriesOrOptions === 'object' && maxRetriesOrOptions !== null) {
    maxRetries = maxRetriesOrOptions.maxRetries ?? 3;
    effectiveTimeoutMs = maxRetriesOrOptions.timeoutMs;
    effectiveTimeoutLabel = maxRetriesOrOptions.timeoutLabel ?? 'API呼び出し';
    effectiveAbortCheck = maxRetriesOrOptions.abortCheck;
  } else if (typeof maxRetriesOrOptions === 'number') {
    maxRetries = maxRetriesOrOptions;
  }
  const standardDelays = [8000, 18000, 30000];
  const delays = standardDelays.slice(0, Math.min(maxRetries, 3));
  const totalMaxAttempts = delays.length;
  for (let attempt = 0; attempt <= totalMaxAttempts; attempt++) {
    if (effectiveAbortCheck && effectiveAbortCheck()) {
      throw new Error('処理が中断されました (Aborted)');
    }
    try {
      const p = fn();
      return effectiveTimeoutMs ? await withTimeout(p, effectiveTimeoutMs, effectiveTimeoutLabel) : await p;
    } catch (err: any) {
      const msg = formatErrorMessage(err).toUpperCase();
      
      if (
        msg.includes('SAFETY') || 
        msg.includes('BLOCKED') || 
        msg.includes('ポリシー') || 
        msg.includes('POLICY') || 
        msg.includes('違反') || 
        msg.includes('INVALID_ARGUMENT') || 
        msg.includes('PERMISSION_DENIED') ||
        (msg.includes(' 400 ') || msg.includes('[STATUS 400]') || msg.includes('[CODE 400]') || msg.includes('400 Bad Request'))
      ) {
        throw err;
      }
      if (attempt === totalMaxAttempts) throw err;
      
      let baseDelay = delays[attempt] ?? 30000;
      const isActivityThrottle = msg.includes('通常とは異なるアクティビティ') || 
        msg.includes('アクティビティ') || 
        msg.includes('429') || 
        msg.includes('RESOURCE_EXHAUSTED') || 
        msg.includes('RATE_LIMIT') || 
        msg.includes('使用量の上限');
      const throttleDelays = [15000, 30000, 45000];
      if (isActivityThrottle) {
        baseDelay = throttleDelays[Math.min(attempt, throttleDelays.length - 1)];
      }
      // 2ワーカーの同時リトライ衝突（ボット検知）を防ぐため、5秒〜20秒のランダム時間差ジッターを付与
      const jitter = 5000 + Math.random() * 15000;
      const roundedDelay = Math.round(baseDelay + jitter);
      
      if (onRetry) {
        onRetry(attempt + 1, totalMaxAttempts, roundedDelay, err, false);
      }
      
      const completed = await sleepWithAbortCheck(roundedDelay, effectiveAbortCheck);
      if (!completed) {
        throw new Error('処理が中断されました (Aborted)');
      }
    }
  }
  throw new Error('Maximum retries reached');
}
/**
 * ログメッセージ生成（Base64等の生データ排除＆1行最大300文字制限）
 */
export function createLogMessage(message: string): string {
  const now = new Date();
  const time = now.toLocaleTimeString('ja-JP', { hour12: false });
  
  if (!message) return `[${time}] `;
  // 1. Base64・長大画像データの置換
  let cleanMsg = String(message)
    .replace(/data:image\/[a-zA-Z0-9.+_-]+;base64,[a-zA-Z0-9+/=]+/g, '[画像データ省略]')
    .replace(/data:application\/[a-zA-Z0-9.+_-]+;base64,[a-zA-Z0-9+/=]+/g, '[バイナリデータ省略]')
    .replace(/[a-zA-Z0-9+/]{200,}={0,2}/g, '[長大データ省略]');
  // 2. 1行あたり最大300文字制限
  if (cleanMsg.length > 300) {
    cleanMsg = cleanMsg.slice(0, 297) + '...';
  }
  return `[${time}] ${cleanMsg}`;
}
// ── IndexedDB ヘルパー ──
let dbInstance: IDBDatabase | null = null;
const DB_NAME = 'EpicTimelineDB';
const ASSET_STORE = 'referenceAssets';
export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 2);
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
export const saveReferenceAsset = async (asset: any): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readwrite');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.add(asset);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};
export const getAllReferenceAssets = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readonly');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as any[]);
    request.onerror = () => reject(request.error);
  });
};
export function createDefaultCut(id: number, narration = '', prompt = '', isSelected = false): any {
  return {
    id,
    promptEn: prompt,
    narrationJp: narration,
    narrationEn: '',
    telop: {
      fullText: narration,
      highlights: [],
      style: 'cinema-subtle',
      transition: 'aos-fade-soft',
      position: 'bottom-center',
      directorNote: '[Webtoon字幕] 下部中央配置'
    },
    isDirecting: false,
    isGeneratingImage: false,
    isGeneratingVideo: false,
    isQueued: false,
    targetVideoModel: 'omni-flash',
    isSelectedForVideo: isSelected
  };
}
export function extractImageBase64(res: any): string | undefined {
  if (!res) return undefined;
  if (typeof res === 'string') {
    const s = res.trim();
    return s.length > 0 ? s : undefined;
  }
  if (typeof res.base64 === 'string' && res.base64.trim()) {
    return res.base64.trim();
  }
  if (res.image) {
    if (typeof res.image === 'string' && res.image.trim()) return res.image.trim();
    if (typeof res.image.base64 === 'string' && res.image.base64.trim()) return res.image.base64.trim();
    if (typeof res.image.imageBytes === 'string' && res.image.imageBytes.trim()) return res.image.imageBytes.trim();
    if (typeof res.image.url === 'string' && res.image.url.trim()) return res.image.url.trim();
  }
  if (typeof res.imageBytes === 'string' && res.imageBytes.trim()) {
    return res.imageBytes.trim();
  }
  if (typeof res.data === 'string' && res.data.trim()) {
    return res.data.trim();
  }
  if (typeof res.url === 'string' && res.url.trim()) {
    return res.url.trim();
  }
  return undefined;
}
export function extractMediaId(res: any): string | undefined {
  if (!res) return undefined;
  if (typeof res.mediaId === 'string' && res.mediaId.trim()) return res.mediaId.trim();
  if (res.image && typeof res.image.mediaId === 'string' && res.image.mediaId.trim()) return res.image.mediaId.trim();
  if (typeof res.id === 'string' && res.id.trim()) return res.id.trim();
  return undefined;
}
export function formatDataUri(raw?: any): string {
  if (!raw) return '';
  let str = '';
  if (typeof raw === 'string') {
    str = raw.trim();
  } else if (typeof raw === 'object') {
    str = (raw.base64 || raw.image?.base64 || raw.url || raw.image?.url || '').trim();
  }
  if (!str || str === '[object Object]') return '';
  
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('blob:')) {
    return str;
  }
  if (str.startsWith('/9j/') || str.startsWith('/9j')) {
    return `data:image/jpeg;base64,${str}`;
  }
  if (str.startsWith('UklG')) {
    return `data:image/webp;base64,${str}`;
  }
  if (str.startsWith('PHN2') || str.startsWith('PD94') || str.startsWith('<svg')) {
    return `data:image/svg+xml;base64,${str}`;
  }
  if (str.startsWith('/') && str.length < 500 && (str.includes('.png') || str.includes('.jpg') || str.includes('.jpeg') || str.includes('.webp') || str.includes('.svg') || str.includes('?'))) {
    return str;
  }
  return `data:image/png;base64,${str}`;
}

