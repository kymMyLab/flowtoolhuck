import { Cut } from '../../types';
import { resolveNeonTheme } from '../../constants';

/**
 * 日本語テキストをスマートに単語・意味ブロックに分割（Ado風リリック単位）
 */
export function splitIntoAdoWords(text: string): string[] {
  const clean = text.replace(/^[「『\s]+|[」』\s:：]+$/g, '').trim();
  if (!clean) return [];

  // スペースや読点があればそれで分割
  if (clean.includes(' ') || clean.includes('　') || clean.includes('、')) {
    const rawParts = clean.split(/[\s　、]+/).filter(Boolean);
    if (rawParts.length >= 2) return rawParts.slice(0, 4);
  }

  // 助詞や文字境界でスマートに2〜3語に分割
  const parts: string[] = [];
  let current = '';
  const particles = ['は', 'が', 'を', 'に', 'へ', 'で', 'と', 'から', 'より', 'の', 'て', 'まま', 'けど', 'たら', 'して'];

  for (let i = 0; i < clean.length; i++) {
    current += clean[i];
    const isParticle = particles.some(p => current.endsWith(p));
    if (isParticle && current.length >= 3 && parts.length < 3 && i < clean.length - 2) {
      parts.push(current);
      current = '';
    } else if (current.length >= 6 && parts.length < 3 && i < clean.length - 2) {
      parts.push(current);
      current = '';
    }
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [clean];
}

/**
 * 音楽MVモード用 Ado風キネティック・タイポグラフィ
 */
export function renderKineticAdoLyrics(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cut: Cut,
  currentTime: number,
  duration: number,
  width: number,
  height: number
) {
  const rawText = cut.telop?.fullText || cut.narrationJp || '';
  if (!rawText.trim()) return;

  const highlights = cut.telop?.highlights || [];
  const words = splitIntoAdoWords(rawText);
  if (words.length === 0) return;

  // タイムライン進行度 (0.0 〜 1.0)
  const progress = Math.max(0, Math.min(1, currentTime / Math.max(duration, 0.1)));

  const transitionKey = cut.telop?.transition || 'blur-slide-left';
  const positionKey = cut.telop?.position || 'bottom-left';
  const isLeftAligned = positionKey === 'bottom-left';

  // 全体の退場アニメーション（0.80 〜 1.0: 出・抜けトランジション）
  let globalExitAlpha = 1;
  let globalExitScale = 1;
  let globalExitOffsetX = 0;
  let globalExitOffsetY = 0;
  let globalExitBlur = 0;

  if (progress > 0.80) {
    const exitT = Math.min(1, (progress - 0.80) / 0.20);
    const easeIn = Math.pow(exitT, 2.2);

    globalExitAlpha = Math.max(0, 1 - exitT * 1.25);

    if (transitionKey === 'blur-slide-left') {
      globalExitOffsetX = easeIn * (width * 0.14);
      globalExitBlur = easeIn * 24;
    } else if (transitionKey === 'blur-slide-up') {
      globalExitOffsetY = -easeIn * (height * 0.07);
      globalExitBlur = easeIn * 20;
    } else if (transitionKey === 'blur-slide-right') {
      globalExitOffsetX = -easeIn * (width * 0.14);
      globalExitBlur = easeIn * 24;
    } else if (transitionKey === 'zoom-in-bounce') {
      globalExitScale = 1.0 + (easeIn * 0.20);
      globalExitBlur = easeIn * 18;
    } else if (transitionKey === 'glow-fade') {
      globalExitScale = 1.0 + (easeIn * 0.04);
      globalExitBlur = easeIn * 26;
    } else if (transitionKey === 'animista-slide-bck') {
      globalExitScale = Math.max(0.5, 1.0 - (easeIn * 0.45));
      globalExitBlur = easeIn * 22;
    } else if (transitionKey === 'aos-fade-soft') {
      globalExitAlpha = Math.max(0, 1 - easeIn * 1.3);
      globalExitOffsetY = -easeIn * (height * 0.04);
    } else if (transitionKey === 'gsap-kinetic-stagger') {
      globalExitOffsetX = easeIn * (width * 0.16);
      globalExitScale = 1.0 + (easeIn * 0.25);
      globalExitBlur = easeIn * 24;
    } else {
      globalExitOffsetX = (exitT > 0.5 ? 6 : -6);
    }
  }

  if (globalExitAlpha <= 0.01) return;

  const baseFontSize = Math.min(width * 0.068, 54);
  const strokeWidth = Math.max(7, baseFontSize * 0.2);
  const lineHeight = baseFontSize * 1.38;

  const totalHeight = words.length * lineHeight;
  const startY = height * 0.78 - (totalHeight * 0.5);

  const xOffsets = isLeftAligned
    ? [0, width * 0.04, width * 0.08, width * 0.12]
    : words.length === 1 ? [0] :
      words.length === 2 ? [-width * 0.08, width * 0.08] :
      [-width * 0.11, 0, width * 0.11];

  const baseX = isLeftAligned ? width * 0.10 : width * 0.5;
  const angles = isLeftAligned ? [-1.5, 0.5, -1.0, 1.0] : [-3.0, 1.8, -2.2, 2.5];

  ctx.save();
  ctx.textAlign = isLeftAligned ? 'left' : 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  words.forEach((wordText, idx) => {
    const wordEntryStart = 0.04 + idx * 0.14;
    const wordEntryDuration = 0.16;

    if (progress < wordEntryStart) return;

    let wordAlpha = 1;
    let wordScale = 1;
    let wordOffsetX = 0;
    let wordOffsetY = 0;
    let motionBlurAmount = 0;

    const timeSinceEntry = progress - wordEntryStart;
    if (timeSinceEntry < wordEntryDuration) {
      const t = Math.min(1, timeSinceEntry / wordEntryDuration);

      if (transitionKey === 'blur-slide-left') {
        const easeOut = 1 - Math.pow(1 - t, 4);
        wordOffsetX = (1 - easeOut) * (-width * 0.18);
        wordAlpha = Math.min(1, t * 2.2);
        motionBlurAmount = (1 - easeOut) * 28;
      } else if (transitionKey === 'blur-slide-up') {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const easeBack = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        wordOffsetY = (1 - easeBack) * (height * 0.07);
        wordAlpha = Math.min(1, t * 2.0);
        motionBlurAmount = (1 - t) * 24;
      } else if (transitionKey === 'blur-slide-right') {
        const easeOut = 1 - Math.pow(1 - t, 4);
        wordOffsetX = (1 - easeOut) * (width * 0.18);
        wordAlpha = Math.min(1, t * 2.2);
        motionBlurAmount = (1 - easeOut) * 28;
      } else if (transitionKey === 'zoom-in-bounce') {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const easeBack = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        wordScale = 0.35 + (easeBack * 0.65);
        wordOffsetY = (1 - easeBack) * (height * 0.04);
        wordAlpha = Math.min(1, t * 2.5);
      } else if (transitionKey === 'glow-fade') {
        wordScale = 0.94 + t * 0.06;
        wordAlpha = Math.min(1, t * 1.8);
        motionBlurAmount = (1 - t) * 35;
      } else if (transitionKey === 'animista-slide-bck') {
        const easeOut = 1 - Math.pow(1 - t, 3);
        wordScale = 1.45 - (easeOut * 0.45);
        wordAlpha = Math.min(1, t * 2.2);
        motionBlurAmount = (1 - t) * 24;
      } else if (transitionKey === 'aos-fade-soft') {
        wordScale = 0.95 + t * 0.05;
        wordOffsetY = (1 - t) * (height * 0.025);
        wordAlpha = Math.min(1, t * 1.6);
      } else if (transitionKey === 'gsap-kinetic-stagger') {
        const c1 = 2.2;
        const c3 = c1 + 1;
        const easeBack = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        wordScale = 0.2 + (easeBack * 0.8);
        wordOffsetY = (1 - easeBack) * (height * 0.06);
        wordAlpha = Math.min(1, t * 2.8);
        motionBlurAmount = (1 - t) * 32;
      } else {
        wordOffsetX = (1 - t) * (idx % 2 === 0 ? -12 : 12);
        wordAlpha = t > 0.3 ? 1 : 0.4;
      }
    } else {
      const holdProgress = (progress - (wordEntryStart + wordEntryDuration)) / (0.84 - (wordEntryStart + wordEntryDuration));
      wordScale = 1.0 + (Math.max(0, holdProgress) * 0.02);
      wordAlpha = 1;
    }

    const currentX = baseX + (xOffsets[idx] || 0) + wordOffsetX + globalExitOffsetX;
    const currentY = startY + idx * lineHeight + wordOffsetY + globalExitOffsetY;
    const angle = angles[idx % angles.length];

    const matchedHighlight = highlights.find(h => h.word && (wordText.includes(h.word) || h.word.includes(wordText)));
    const isHighlighted = !!matchedHighlight;
    const neonTheme = resolveNeonTheme(wordText, idx, cut.id || 1, matchedHighlight?.color);

    const textColor = isHighlighted ? neonTheme.color : '#FFFFFF';
    const textGlow = isHighlighted ? neonTheme.glow : 'rgba(255, 255, 255, 0.7)';
    const highlightSizeBoost = isHighlighted ? 1.35 : 1.0;

    ctx.save();
    ctx.translate(currentX, currentY);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.scale(wordScale * globalExitScale * highlightSizeBoost, wordScale * globalExitScale * highlightSizeBoost);
    ctx.globalAlpha = Math.max(0, Math.min(1, wordAlpha * globalExitAlpha));

    ctx.font = `900 ${baseFontSize}px "Zen Kaku Gothic New", "Impact", "Montserrat Black", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;

    const totalBlur = Math.max(motionBlurAmount, globalExitBlur);

    if (totalBlur > 2) {
      ctx.save();
      ctx.shadowColor = textGlow;
      ctx.shadowBlur = totalBlur;
      const blurDirX = globalExitBlur > 0 ? (transitionKey === 'blur-slide-left' ? 1 : transitionKey === 'blur-slide-right' ? -1 : 0) :
                                            (transitionKey === 'blur-slide-left' ? -1 : transitionKey === 'blur-slide-right' ? 1 : 0);
      const blurDirY = globalExitBlur > 0 ? (transitionKey === 'blur-slide-up' ? -1 : 0) :
                                            (transitionKey === 'blur-slide-up' ? 1 : 0);
      ctx.shadowOffsetX = blurDirX * totalBlur * 0.6;
      ctx.shadowOffsetY = blurDirY * totalBlur * 0.6;
      ctx.fillStyle = textColor;
      ctx.fillText(wordText, 0, 0);
      ctx.restore();
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = isHighlighted ? 28 : 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    if (isHighlighted) {
      ctx.shadowColor = textGlow;
      ctx.shadowBlur = 24;
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = strokeWidth * (isHighlighted ? 1.25 : 1.0);
    ctx.strokeText(wordText, 0, 0);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = textColor;
    ctx.fillText(wordText, 0, 0);

    ctx.restore();
  });

  ctx.restore();
}

/**
 * 標準字幕（シネマティック字幕・グラスモーフィズム座布団）
 */
export function renderStandardSubtitles(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  cut: Cut
) {
  const rawText = cut.telop?.fullText || cut.narrationJp || '';
  if (!rawText.trim()) return;

  const text = rawText.replace(/^[\s「『]+|[:：\s」』]+$/g, '').slice(0, 36);
  const highlights = cut.telop?.highlights || [];
  const baseFontSize = 38;
  const kanjiScale = 1.06;
  const strokeWidth = 8;
  const letterMargin = 4;
  const maxWidth = width * 0.92;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const highlightIndices = new Map<number, { color: string; sizeScale: number }>();
  highlights.forEach(h => {
    if (!h.word) return;
    let pos = 0;
    while ((pos = text.indexOf(h.word, pos)) !== -1) {
      for (let k = 0; k < h.word.length; k++) {
        highlightIndices.set(pos + k, h);
      }
      pos += 1;
    }
  });

  const charData = text.split('').map((char, index) => {
    const isKanji = /[\u4e00-\u9faf]/.test(char);
    const highlight = highlightIndices.get(index);
    return {
      char,
      isKanji,
      color: highlight ? (highlight.color || '#FFE600') : 'white',
      scale: (highlight ? (highlight.sizeScale || 1.15) : 1.0) * (isKanji ? kanjiScale : 1.0)
    };
  });

  const lines: typeof charData[] = [];
  let currentLine: typeof charData = [];
  let currentLineWidth = 0;

  charData.forEach(d => {
    ctx.font = `900 ${baseFontSize * d.scale}px "Noto Sans JP", sans-serif`;
    const w = ctx.measureText(d.char).width + letterMargin;
    if (currentLineWidth + w > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [d];
      currentLineWidth = w;
    } else {
      currentLine.push(d);
      currentLineWidth += w;
    }
  });
  if (currentLine.length > 0) lines.push(currentLine);

  const lineHeight = baseFontSize * 1.5;
  const totalHeight = lines.length * lineHeight;
  const plateY = height * 0.84;

  let maxLineWidth = 0;
  lines.forEach(line => {
    let w = 0;
    line.forEach(d => {
      ctx.font = `900 ${baseFontSize * d.scale}px "Noto Sans JP", sans-serif`;
      w += ctx.measureText(d.char).width + letterMargin;
    });
    if (w > maxLineWidth) maxLineWidth = w;
  });

  const boxWidth = Math.min(width * 0.94, maxLineWidth + 44);
  const boxHeight = totalHeight + 28;
  const boxX = (width - boxWidth) / 2;
  const boxY = plateY - boxHeight / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(boxX, boxY, boxWidth, boxHeight, 18);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  }
  ctx.restore();

  const startY = plateY - totalHeight / 2;

  lines.forEach((line, lineIdx) => {
    let lineTotalWidth = 0;
    line.forEach(d => {
      ctx.font = `900 ${baseFontSize * d.scale}px "Noto Sans JP", sans-serif`;
      lineTotalWidth += ctx.measureText(d.char).width + letterMargin;
    });

    const y = startY + (lineIdx + 0.5) * lineHeight;
    let currentX = (width - lineTotalWidth) / 2;

    line.forEach(d => {
      const fontSize = baseFontSize * d.scale;
      ctx.font = `900 ${fontSize}px "Noto Sans JP", sans-serif`;
      const charWidth = ctx.measureText(d.char).width;
      const x = currentX + charWidth / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      ctx.strokeStyle = 'black';
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(d.char, x, y);

      ctx.fillStyle = d.color;
      ctx.fillText(d.char, x, y);
      ctx.restore();

      currentX += charWidth + letterMargin;
    });
  });
  ctx.restore();
}

/**
 * 静止画字幕の描画結果を1枚のオフスクリーンCanvasに事前キャッシュする（フレームループ高速化用）
 */
export function createCachedSubtitleCanvas(width: number, height: number, cut: Cut): OffscreenCanvas | null {
  const rawText = cut.telop?.fullText || cut.narrationJp || '';
  if (!rawText.trim()) return null;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  renderStandardSubtitles(ctx, width, height, cut);
  return canvas;
}

/**
 * 字幕描画の統合Facade（Strategy切り替え）
 */
export function drawBakedSubtitles(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  cut: Cut,
  currentTime: number = 0,
  duration: number = 4,
  isMvMode: boolean = false
) {
  const rawText = cut.telop?.fullText || cut.narrationJp || '';
  if (!rawText.trim()) return;

  if (isMvMode || cut.telop?.style?.startsWith('mv-')) {
    renderKineticAdoLyrics(ctx, cut, currentTime, duration, width, height);
  } else {
    renderStandardSubtitles(ctx, width, height, cut);
  }
}
