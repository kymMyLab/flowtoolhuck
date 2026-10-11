import { Episode } from '../../types';

/**
 * SRT形式のタイムコード生成 (HH:MM:SS,mmm)
 */
export function formatSRTTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00,000";
  const date = new Date(0);
  date.setUTCMilliseconds(Math.floor(seconds * 1000));
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * EpisodeデータからSRT字幕ファイルを生成
 */
export function generateSRT(ep: Episode): string {
  let srt = '';
  let currentTime = 2.0; // 冒頭2秒の扉絵分をオフセット

  ep.cuts.forEach((cut, index) => {
    let duration = Number(cut.videoDuration);
    if (isNaN(duration) || duration <= 0) {
      duration = Math.max(4, (cut.narrationJp?.length || 0) * 0.25);
    }
    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + duration);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${cut.narrationJp || ''}\n\n`;

    currentTime += duration;
  });

  return srt;
}
