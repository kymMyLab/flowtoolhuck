export function safeJsonParse<T>(raw: any, defaultValue: T = {} as T): T {
  if (!raw) return defaultValue;

  // すでにパース済みのオブジェクトであればそのまま返す
  if (typeof raw === 'object' && raw !== null && !('text' in raw)) {
    return raw as T;
  }

  // 文字列の抽出
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

  if (!text || typeof text !== 'string' || !text.trim() || !text.includes('{')) {
    return defaultValue;
  }

  try {
    const cleanText = text.replace(/```json\n?|```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return defaultValue;
    }
    
    const jsonStr = cleanText.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    console.warn('JSON Parse Error:', err);
    return defaultValue;
  }
}

/** 
 * エラーオブジェクトから詳細な理由を抽出する
 */
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

/** 
 * 指定ミリ秒で強制タイムアウトさせるラッパー
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = '処理'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}がタイムアウト（${Math.round(timeoutMs / 1000)}秒経過）しました`)), timeoutMs)
    )
  ]);
}

/** 
 * 堅牢な指数バックオフ・リトライ
 * SAFETY/BLOCKED等の即死エラー時はリトライせず即時スローする
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number, err: any) => void,
  maxRetries = 5,
  timeoutMs?: number,
  timeoutLabel = 'API呼び出し'
): Promise<T> {
  const baseDelayMs = 2000;
  const factor = 2;
  const maxDelayMs = 30000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const p = fn();
      return timeoutMs ? await withTimeout(p, timeoutMs, timeoutLabel) : await p;
    } catch (err: any) {
      const msg = formatErrorMessage(err).toUpperCase();
      
      // 即死エラー（セーフティ、ブロック、引数エラー）はリトライしない
      if (
        msg.includes('SAFETY') || 
        msg.includes('BLOCKED') || 
        msg.includes('INVALID_ARGUMENT') || 
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('400')
      ) {
        throw err;
      }

      if (attempt === maxRetries) throw err;
      
      const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(factor, attempt)) + (Math.random() * 1000);
      const roundedDelay = Math.round(delay);
      
      if (onRetry) onRetry(attempt + 1, maxRetries, roundedDelay, err);
      
      await new Promise(r => setTimeout(r, roundedDelay));
    }
  }
  throw new Error('Maximum retries reached');
}

export function createLogMessage(message: string): string {
  const now = new Date();
  const time = now.toLocaleTimeString('ja-JP', { hour12: false });
  return `[${time}] ${message}`;
}

export function isCutSelectedForVideo(idx: number, ratio?: string): boolean {
  if (ratio === '30%') return [0, 4, 8, 11].includes(idx);
  if (ratio === '50%') return [0, 2, 4, 6, 8, 10].includes(idx);
  if (ratio === '100%') return true;
  return false;
}

export function createDefaultCut(id: number, narration = '', prompt = '', isSelected = false): any {
  return {
    id,
    promptEn: prompt,
    narrationJp: narration,
    narrationEn: '',
    telop: {
      fullText: narration,
      highlights: [],
      style: 'mv-blur-slide',
      transition: 'blur-slide-left',
      position: 'bottom-left',
      directorNote: '静寂から加速するビートに合わせたブラースライド演出'
    },
    isDirecting: false,
    isGeneratingImage: false,
    isGeneratingVideo: false,
    isQueued: false,
    targetVideoModel: 'veo-lite',
    isSelectedForVideo: isSelected
  };
}