import React, { useMemo, useRef } from 'react';
import { Cut } from '../../types';
import { 
  STUDIO_NEON_PALETTE, 
  resolveNeonTheme 
} from '../../constants';
import { extractHighlights, buildLyricLines } from '../../services/directorService';
import { normalizeKenBurnsPreset } from '../../services/renderers/kenBurns';

export interface PreviewPlayerProps {
  cut: Cut;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCuts?: number;
  showTelop: boolean;
  onToggleTelop: () => void;
  isRewriting?: boolean;
}

// 複数行（2枠以上）の時に、行ごとに入り・出のベクトルをダイナミックに対向・ランダム化
function getLineMotion(lineIdx: number, totalLines: number, baseMotion: string, cutId: number): string {
  if (totalLines <= 1) return baseMotion;

  const motionPairs = [
    ['vook-motion-in-left-out-right', 'vook-motion-in-right-out-left'], // 1: 左右すれ違い突き抜けスルー
    ['vook-motion-in-top-out-down', 'vook-motion-in-bottom-out-up'],    // 2: 上下垂直クロス
    ['vook-motion-in-top-out-down', 'vook-motion-in-right-out-left'],   // 3: 上から落下 ＆ 右から突き抜け
    ['vook-motion-in-zoom-out-up', 'vook-motion-in-bottom-out-up'],     // 4: ズームイン昇天 ＆ 下からリフト
    ['vook-motion-in-left-out-left', 'vook-motion-in-right-out-right'], // 5: 各自リバース戻り
    ['vook-motion-in-zoom-out-down', 'vook-motion-in-left-out-right']   // 6: ズーム沈降 ＆ 左から右スルー
  ];
  const pairIdx = (cutId + lineIdx) % motionPairs.length;
  const pair = motionPairs[pairIdx];
  return pair[lineIdx % pair.length];
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  cut,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentIndex,
  totalCuts,
  showTelop,
  onToggleTelop,
  isRewriting = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoSrc = cut.videoBase64
    ? (cut.videoBase64.startsWith('data:') ? cut.videoBase64 : `data:video/mp4;base64,${cut.videoBase64}`)
    : null;
  const imageSrc = cut.imageBase64 ? `data:image/png;base64,${cut.imageBase64}` : null;

  const getKenBurnsClass = () => {
    if (videoSrc || !imageSrc) return '';
    const preset = normalizeKenBurnsPreset(cut.kenBurnsPreset);
    if (preset === 'none') return '';
    return `studio-kb-${preset}`;
  };

  const telopContent = useMemo(() => {
    const rawText = (cut.telop?.fullText || cut.narrationJp || '').trim();
    if (!showTelop || !rawText) return null;

    const text = rawText;
    const highlights = (cut.telop?.highlights && cut.telop.highlights.length > 0)
      ? cut.telop.highlights
      : extractHighlights(text);

    const transKey = cut.telop?.transition || 'blur-slide-left';
    const defaultMotionClass =
      transKey === 'animista-slide-bck' ? 'vook-motion-animista-slide-bck' :
      transKey === 'aos-fade-soft' ? 'vook-motion-aos-fade-soft' :
      transKey === 'gsap-kinetic-stagger' ? 'vook-motion-gsap-kinetic-stagger' :
      transKey === 'blur-slide-up' ? 'vook-motion-blur-slide-up' :
      transKey === 'blur-slide-right' ? 'vook-motion-blur-slide-right' :
      transKey === 'zoom-in-bounce' ? 'vook-motion-zoom-bounce' :
      transKey === 'glow-fade' ? 'vook-motion-glow-fade' :
      transKey === 'glitch-pop' ? 'vook-motion-glitch-pop' :
      'vook-motion-blur-slide-left';

    const posKey = cut.telop?.position || 'bottom-center';
    const isPlateStyle = cut.telop?.style === 'cinema-subtle' || cut.telop?.style === 'traditional-sumi';

    if (!isPlateStyle) {
      const lyricLines = buildLyricLines(text, highlights);

      const isVertical = posKey === 'vertical-right' || posKey === 'vertical-left';
      const isRightSide = posKey === 'vertical-right';
      const isTop = posKey === 'top-cinema';
      const isCenter = posKey === 'center-climax' || posKey === 'center-stagger';
      const isLeft = posKey === 'bottom-left';
      const isRight = posKey === 'bottom-right';

      // 縦書きレイアウト（和モダン・エモMV風）
      if (isVertical) {
        return (
          <div
            key={`${transKey}-${cut.telop?.style}-${posKey}-${text}`}
            className={`absolute top-[8%] ${isRightSide ? 'right-[5%]' : 'left-[5%]'} h-[80%] max-h-[82%] flex ${isRightSide ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5 pointer-events-none z-40 select-none`}
          >
            {lyricLines.map((line, wIdx) => {
              const delay = wIdx * 0.12;
              const motionClass = getLineMotion(wIdx, lyricLines.length, defaultMotionClass, cut.id || 1);

              const firstHighlight = line.segments.find(s => s.isHighlight);
              const neonTheme = firstHighlight
                ? resolveNeonTheme(firstHighlight.text, wIdx, cut.id || 1, firstHighlight.color)
                : STUDIO_NEON_PALETTE[0];

              return (
                <div
                  key={wIdx}
                  className={`${motionClass} vertical-text-flow`}
                  style={{
                    animationDelay: `${delay}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <div className={`inline-block whitespace-nowrap backdrop-blur-md rounded-2xl transition-all shadow-2xl px-2 py-4 ${
                    line.hasHighlight
                      ? `bg-black/80 border ${neonTheme.border} ${neonTheme.shadow}`
                      : 'bg-black/55 border border-white/10'
                  }`}>
                    {line.segments.map((seg, sIdx) => {
                      const segNeon = seg.isHighlight
                        ? resolveNeonTheme(seg.text, sIdx, cut.id || 1, seg.color)
                        : null;

                      return (
                        <span
                          key={sIdx}
                          className="font-[900] select-none inline"
                          style={{
                            color: seg.isHighlight ? (segNeon?.color || '#FFE600') : '#FFFFFF',
                            fontSize: seg.isHighlight ? '1.45rem' : '1.2rem',
                            textShadow: seg.isHighlight ? segNeon?.glow : '0 2px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.85)',
                            fontFamily: '"Zen Kaku Gothic New", "Montserrat", "Outfit", "Noto Sans JP", sans-serif',
                            letterSpacing: '0.14em',
                            lineHeight: 1.2
                          }}
                        >
                          {seg.text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      // 横書きレイアウト
      const isClimax = posKey === 'center-climax';
      const xOffsets = isLeft
        ? ['0%', '3%', '6%', '9%']
        : isRight
        ? ['0%', '-3%', '-6%', '-9%']
        : lyricLines.length === 1 ? ['0%'] :
          lyricLines.length === 2 ? ['-4%', '4%'] :
          ['-5%', '0%', '5%'];

      const angles = isLeft ? [-1.0, 0.8, -0.6, 0.8] :
                     isRight ? [1.0, -0.8, 0.6, -0.8] :
                     isClimax ? [-0.8, 0.8, -0.5] :
                     [-1.2, 0.8, -1.0, 1.2];

      const containerPositionClass =
        isTop ? 'top-[7%] left-0 right-0 px-4 items-center justify-start' :
        isCenter ? 'top-1/2 left-0 right-0 -translate-y-1/2 px-4 items-center justify-center' :
        isLeft ? 'bottom-[6%] left-0 right-0 px-5 items-start justify-end' :
        isRight ? 'bottom-[6%] left-0 right-0 px-5 items-end justify-end' :
        'bottom-[8%] left-0 right-0 px-4 items-center justify-end';

      const alignmentClass = isLeft ? 'items-start text-left' : isRight ? 'items-end text-right' : 'items-center text-center';

      return (
        <div
          key={`${transKey}-${cut.telop?.style}-${posKey}-${text}`}
          className={`absolute ${containerPositionClass} w-full flex flex-col pointer-events-none z-40 select-none`}
        >
          <div className={`flex flex-col ${alignmentClass} gap-2 w-full max-w-[96%]`}>
            {lyricLines.map((line, wIdx) => {
              const angle = angles[wIdx % angles.length];
              const xOff = xOffsets[wIdx] || '0%';
              const delay = wIdx * 0.12;
              const motionClass = getLineMotion(wIdx, lyricLines.length, defaultMotionClass, cut.id || 1);

              const firstHighlight = line.segments.find(s => s.isHighlight);
              const neonTheme = firstHighlight
                ? resolveNeonTheme(firstHighlight.text, wIdx, cut.id || 1, firstHighlight.color)
                : STUDIO_NEON_PALETTE[0];

              return (
                <div
                  key={wIdx}
                  className={`${motionClass} ${isRight ? 'self-end' : isLeft ? 'self-start' : 'self-center'}`}
                  style={{
                    transform: `translateX(${xOff}) rotate(${angle}deg)`,
                    animationDelay: `${delay}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <div className={`inline-flex items-baseline whitespace-nowrap backdrop-blur-md rounded-xl transition-all shadow-2xl px-3.5 py-1 ${
                    line.hasHighlight
                      ? `bg-black/75 border ${neonTheme.border} ${neonTheme.shadow}`
                      : 'bg-black/50 border border-white/10'
                  }`}>
                    {line.segments.map((seg, sIdx) => {
                      const segNeon = seg.isHighlight
                        ? resolveNeonTheme(seg.text, sIdx, cut.id || 1, seg.color)
                        : null;

                      return (
                        <span
                          key={sIdx}
                          className="font-[900] select-none inline-block align-baseline whitespace-nowrap"
                          style={{
                            color: seg.isHighlight ? (segNeon?.color || '#FFE600') : '#FFFFFF',
                            fontSize: isClimax
                              ? (seg.isHighlight ? '1.85rem' : '1.4rem')
                              : (seg.isHighlight ? '1.55rem' : '1.25rem'),
                            textShadow: seg.isHighlight ? segNeon?.glow : '0 2px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.85)',
                            fontFamily: '"Zen Kaku Gothic New", "Montserrat", "Outfit", "Noto Sans JP", sans-serif',
                            letterSpacing: seg.isHighlight ? '0.03em' : '0.01em',
                            lineHeight: 1.15
                          }}
                        >
                          {seg.text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // プレートスタイル（cinema-subtle / traditional-sumi）
    const wordThemeMap = new Map<string, { color: string; glow: string; border: string; shadow: string }>();
    highlights.forEach((h, hIdx) => {
      if (!h.word) return;
      const theme = resolveNeonTheme(h.word, hIdx, cut.id || 1, h.color);
      wordThemeMap.set(h.word, theme);
    });

    const highlightIndices = new Map<number, { color: string; sizeScale: number; word: string; glow: string }>();
    highlights.forEach((h) => {
      if (!h.word) return;
      const theme = wordThemeMap.get(h.word) || STUDIO_NEON_PALETTE[0];
      let pos = 0;
      while ((pos = text.indexOf(h.word, pos)) !== -1) {
        for (let k = 0; k < h.word.length; k++) {
          highlightIndices.set(pos + k, {
            word: h.word,
            color: theme.color,
            glow: theme.glow,
            sizeScale: h.sizeScale || 1.15
          });
        }
        pos += 1;
      }
    });

    const platePosClass =
      posKey === 'top-cinema' ? 'top-[6%] items-center' :
      (posKey === 'center-climax' || posKey === 'center-stagger') ? 'top-1/2 -translate-y-1/2 items-center' :
      posKey === 'bottom-left' ? 'bottom-[5%] items-start pl-6' :
      posKey === 'bottom-right' ? 'bottom-[5%] items-end pr-6' :
      'bottom-[5%] items-center';

    return (
      <div
        key={`${transKey}-${cut.telop?.style}-${posKey}-${text}`}
        className={`absolute ${platePosClass} left-0 w-full px-4 flex flex-col pointer-events-none z-40 ${defaultMotionClass}`}
        style={{ animationFillMode: 'both' }}
      >
        <div className="bg-black/70 backdrop-blur-md rounded-2xl px-5 py-2.5 flex flex-wrap justify-center items-baseline max-w-[92%] shadow-xl shadow-black/40 border border-white/15 leading-snug">
          {text.split('').map((char, i) => {
            const isKanji = /[\u4e00-\u9faf]/.test(char);
            const isPunctuation = /[。、！？…]/.test(char);
            const highlight = highlightIndices.get(i);

            const color = highlight ? highlight.color : '#FFFFFF';
            const glow = highlight ? highlight.glow : '0 2px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9)';
            const scale = (isKanji ? 1.05 : 1.0) * (highlight ? highlight.sizeScale : 1.0);

            return (
              <span
                key={i}
                className="font-[900] tracking-normal select-none"
                style={{
                  color: color,
                  fontSize: `${scale * 1.15}rem`,
                  display: isPunctuation ? 'inline' : 'inline-block',
                  margin: isPunctuation ? '0 1px 0 -1px' : '0 0.5px',
                  textShadow: glow,
                  fontFamily: '"Zen Kaku Gothic New", "Montserrat", "Noto Sans JP", sans-serif'
                }}
              >
                {char}
              </span>
            );
          })}
        </div>
      </div>
    );
  }, [showTelop, cut.telop, cut.narrationJp, cut.id]);

  return (
    <div className="flex-1 bg-black relative flex items-center justify-center p-3 sm:p-6 lg:p-10 min-h-0 overflow-hidden">
      <div className="relative h-full w-full flex items-center justify-center">

        {/* ── 👈 前のカットへ移動する矢印ボタン ── */}
        {hasPrev && onPrev && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onPrev(); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/75 hover:bg-amber-500 hover:text-black border border-white/20 hover:border-amber-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
            title="前のカットへ移動 (キーボード ←)"
          >
            <span className="material-symbols-outlined text-[26px] sm:text-[30px] group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
          </button>
        )}

        {/* ── 👉 次のカットへ移動する矢印ボタン ── */}
        {hasNext && onNext && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onNext(); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/75 hover:bg-amber-500 hover:text-black border border-white/20 hover:border-amber-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
            title="次のカットへ移動 (キーボード →)"
          >
            <span className="material-symbols-outlined text-[26px] sm:text-[30px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
          </button>
        )}

        {/* ── カット番号インジケーター ── */}
        {currentIndex !== undefined && totalCuts !== undefined && (
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-50 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-bold flex items-center gap-1.5 shadow-xl select-none">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Cut {currentIndex} / {totalCuts}</span>
          </div>
        )}

        <div className="relative h-full max-h-full aspect-[9/16] shadow-2xl rounded-xl overflow-hidden border border-white/10 group bg-[#111] flex items-center justify-center">
          {videoSrc ? (
            <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain block" autoPlay loop playsInline />
          ) : imageSrc ? (
            <div className="w-full h-full overflow-hidden flex items-center justify-center">
              <img src={imageSrc} className={`w-full h-full object-contain block ${getKenBurnsClass()}`} alt="Preview" />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/10 gap-3 uppercase tracking-widest text-[10px]">Rendering</div>
          )}

          {telopContent}

          <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onToggleTelop}
              className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${showTelop ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black/60 border-white/20 text-white/40'}`}
              title="テロップ表示切替"
            >
              <span className="material-symbols-outlined text-[20px]">{showTelop ? 'subtitles' : 'subtitles_off'}</span>
            </button>
          </div>

          {(isRewriting || cut.isGeneratingImage) && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 animate-in fade-in duration-200">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-xs font-black text-amber-400 tracking-widest uppercase animate-pulse">
                {isRewriting ? '✨ 指示を反映中...' : '🎨 描画中...'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
