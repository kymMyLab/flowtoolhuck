export function safeJsonParse<T>(raw: any, defaultValue: T = {} as T): T {
  if (!raw) return defaultValue;

  // すでにパース済みのオブジェクトまたは配列であればそのまま返す
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

  if (!text || typeof text !== 'string' || !text.trim()) {
    return defaultValue;
  }

  const cleanText = text.replace(/```json\n?|```/g, '').trim();

  // 配列またはオブジェクトの開始位置を検出
  const firstBrace = cleanText.indexOf('{');
  const firstBracket = cleanText.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) {
    return defaultValue;
  }

  try {
    // 配列が外側にある場合 ([...])
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      const lastBracket = cleanText.lastIndexOf(']');
      if (lastBracket > firstBracket) {
        const jsonStr = cleanText.slice(firstBracket, lastBracket + 1);
        return JSON.parse(jsonStr) as T;
      }
    }

    // オブジェクトが外側にある場合 ({...})
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
  if (durationMs <= 0) return true;
  return new Promise((resolve) => {
    // Immediate check
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
  // 超指数バックオフ用スケジュール: 10分, 20分, 30分, 60分 (計4回・最大約2時間耐久)
  const superDelays = [10 * 60 * 1000, 20 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];

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
      
      // 即死エラー（セーフティ、ブロック、ポリシー違反、引数エラー）は無駄な待機リトライをせず即座に上位ハンドラへ投げる
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
      
      let baseDelay = delays[attempt] ?? 80000;
      // Googleのアクセス制限・アクティビティ検知時は、早すぎる再叩きで規制が長引かないよう最低20秒の冷却待機を確保
      const isActivityThrottle = msg.includes('通常とは異なるアクティビティ') || msg.includes('アクティビティ') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('RATE_LIMIT');
      if (isActivityThrottle && baseDelay < 20000) {
        baseDelay = 20000;
      }

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
    targetVideoModel: 'omni-flash',
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

/**
 * Flow.generate.image 等の各種 Flow SDK / Gemini 返却オブジェクトから
 * base64 文字列（または画像URL）を確実に抽出する堅牢なパーサー
 */
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

/**
 * 画像データ（base64、データURI、HTTP URL、相対パス）を安全にブラウザ表示可能なURLに変換
 * ★最重要: JPEGのbase64（先頭が '/9j/' で始まる）を誤って相対パスとみなさないよう厳密判定
 */
export function formatDataUri(raw?: any): string {
  if (!raw) return '';
  let str = '';
  if (typeof raw === 'string') {
    str = raw.trim();
  } else if (typeof raw === 'object') {
    str = (raw.base64 || raw.image?.base64 || raw.url || raw.image?.url || '').trim();
  }
  if (!str || str === '[object Object]') return '';
  
  // すでに有効なURIプロトコルを持っている場合
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('blob:')) {
    return str;
  }

  // ★超重要: JPEG base64は \xFF\xD8\xFF のbase64エンコードにより必ず '/9j/' で始まる！
  // スラッシュで始まるからといって相対パスと誤認しては絶対にダメ！
  if (str.startsWith('/9j/') || str.startsWith('/9j')) {
    return `data:image/jpeg;base64,${str}`;
  }
  if (str.startsWith('UklG')) {
    return `data:image/webp;base64,${str}`;
  }
  if (str.startsWith('PHN2') || str.startsWith('PD94') || str.startsWith('<svg')) {
    return `data:image/svg+xml;base64,${str}`;
  }

  // 本物のWeb相対パス（例: /images/logo.png）のみを許可（短く、かつ拡張子を持つ）
  if (str.startsWith('/') && str.length < 500 && (str.includes('.png') || str.includes('.jpg') || str.includes('.jpeg') || str.includes('.webp') || str.includes('.svg') || str.includes('?'))) {
    return str;
  }

  // デフォルトは PNG または raw base64
  return `data:image/png;base64,${str}`;
}