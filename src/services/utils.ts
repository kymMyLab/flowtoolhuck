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

export interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  timeoutLabel?: string;
  superBackoff?: boolean;
  abortCheck?: () => boolean;
}

/**
 * ミリ秒を人間が読みやすい「〇〇秒」または「〇〇分間」の文字列に変換
 */
export function formatDurationMs(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.round(ms / 60000);
    return `${mins}分間`;
  }
  return `${Math.round(ms / 1000)}秒`;
}

/**
 * 緊急停止（Abort）を即座に検知可能なスリープ
 */
export async function sleepWithAbortCheck(durationMs: number, abortCheck?: () => boolean): Promise<boolean> {
  const stepMs = 500;
  let elapsed = 0;
  while (elapsed < durationMs) {
    if (abortCheck && abortCheck()) {
      return false; // 中断された
    }
    const wait = Math.min(stepMs, durationMs - elapsed);
    await new Promise(r => setTimeout(r, wait));
    elapsed += wait;
  }
  return true;
}

/** 
 * 堅牢な指数バックオフ・リトライ
 * デフォルト間隔: 5秒、10秒、20秒、40秒、80秒（計5回）
 * 超指数バックオフ(superBackoff): さらに 10分、20分、30分 を追加（夜間放置完走用・計8回）
 * SAFETY/BLOCKED等の即死エラー時はリトライせず即時スローする
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number, err: any, isSuperBackoff?: boolean) => void,
  maxRetriesOrOptions: number | RetryOptions = 5,
  timeoutMs?: number,
  timeoutLabel = 'API呼び出し',
  superBackoff = false,
  abortCheck?: () => boolean
): Promise<T> {
  let maxRetries = 5;
  let effectiveTimeoutMs = timeoutMs;
  let effectiveTimeoutLabel = timeoutLabel;
  let effectiveSuperBackoff = superBackoff;
  let effectiveAbortCheck = abortCheck;

  if (typeof maxRetriesOrOptions === 'object' && maxRetriesOrOptions !== null) {
    maxRetries = maxRetriesOrOptions.maxRetries ?? 5;
    effectiveTimeoutMs = maxRetriesOrOptions.timeoutMs;
    effectiveTimeoutLabel = maxRetriesOrOptions.timeoutLabel ?? 'API呼び出し';
    effectiveSuperBackoff = !!maxRetriesOrOptions.superBackoff;
    effectiveAbortCheck = maxRetriesOrOptions.abortCheck;
  } else if (typeof maxRetriesOrOptions === 'number') {
    maxRetries = maxRetriesOrOptions;
  }

  // デフォルト待機スケジュール: 5s, 10s, 20s, 40s, 80s
  const standardDelays = [5000, 10000, 20000, 40000, 80000];
  // 超指数バックオフ用スケジュール: 10分, 20分, 30分
  const superDelays = [10 * 60 * 1000, 20 * 60 * 1000, 30 * 60 * 1000];

  const delays = effectiveSuperBackoff
    ? [...standardDelays, ...superDelays]
    : standardDelays.slice(0, maxRetries);

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

      if (attempt === totalMaxAttempts) throw err;
      
      const baseDelay = delays[attempt] ?? 80000;
      const isSuper = effectiveSuperBackoff && attempt >= standardDelays.length;
      // ジッター加算（通常は0〜1秒、超バックオフ時は0〜5秒）
      const jitter = isSuper ? Math.random() * 5000 : Math.random() * 1000;
      const roundedDelay = Math.round(baseDelay + jitter);
      
      if (onRetry) {
        onRetry(attempt + 1, totalMaxAttempts, roundedDelay, err, isSuper);
      }
      
      // 中断チェック付きスリープ
      const completed = await sleepWithAbortCheck(roundedDelay, effectiveAbortCheck);
      if (!completed) {
        throw new Error('処理が中断されました (Aborted)');
      }
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

/**
 * サンドボックス iframe（Permissions Policy で Clipboard API がブロックされている環境）でも
 * 確実に動作するクリップボードコピー関数（execCommand フォールバック付き）
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. まず標準の navigator.clipboard を試す
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permissions policy 等で弾かれた場合は execCommand フォールバックへ進む
    }
  }

  // 2. document.execCommand('copy') によるフォールバック
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.error('execCommand copy failed', err);
  }

  return false;
}