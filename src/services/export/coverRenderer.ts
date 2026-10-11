import { Episode } from '../../types';
import { checkIsHistorical } from '../directorService';

/**
 * 動画や扉絵用にタイトル文字列をクリーン化
 */
export const cleanTitle = (title: string) => {
  return (title || '無題').replace(/\s*\(Ep\.\s*\d+\)/gi, '').trim();
};

/**
 * 世界観適応型 レイヤー合成インフォグラフィック扉絵（9:16特大ポスター）
 * Cut 1のキメ絵を下部に下げて配置し、上部に世界観（MV・江戸・雑学・漫才等）に応じた
 * インフォグラフィック看板プレートをドッキング合成する（物理的被りゼロ保証）
 */
export async function renderCoverCanvas(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 1080;
  const height = 1920;
  const canvas = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Canvas context failed');

  // 世界観・モード判定（江戸に拘らずどんな画風でも動的適応）
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const isHist = checkIsHistorical(ep.era, ep.theme);
  const mode = ep.productionMode || (isMv ? 'mv' : 'episodes');
  const combinedContext = `${ep.era || ''} ${ep.theme || ''} ${mode}`.toLowerCase();
  const isTrivia = mode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説');
  const isManzai = mode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席');
  const isCraft = mode === 'craft' || combinedContext.includes('職人') || combinedContext.includes('工芸');

  // 背景ベース色
  ctx.fillStyle = '#08080A';
  ctx.fillRect(0, 0, width, height);

  // 1. Cut 1の確定キメ絵（またはマスターアンカー）を下部に下げて配置
  const cut1Base64 = ep.masterAnchorBase64 || ep.cuts[0]?.imageBase64;
  const headerHeight = 520; // 看板専用エリア（上部約27%）

  if (cut1Base64) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed'));
        i.src = cut1Base64.startsWith('data:') ? cut1Base64 : `data:image/png;base64,${cut1Base64}`;
      });

      // 絵を下部（headerHeight から下）にゆったり配置
      // キャラクターの顔・頭部が看板と絶対に衝突しないように、オフセット配置
      const imgTargetY = headerHeight - 40; 
      const imgTargetH = height - imgTargetY;
      const imgScale = Math.max(width / img.width, imgTargetH / img.height);
      const scaledW = img.width * imgScale;
      const scaledH = img.height * imgScale;
      const imgOffsetX = (width - scaledW) / 2;
      const imgOffsetY = imgTargetY + (imgTargetH - scaledH) / 2;

      ctx.save();
      // 上部看板エリアと境界をぼかすグラデーションマスク
      ctx.drawImage(img, imgOffsetX, imgOffsetY, scaledW, scaledH);
      
      // 暗幕グラデーション（下部の安定化 ＆ 上部看板とのシームレス接続）
      const scrim = ctx.createLinearGradient(0, headerHeight - 80, 0, headerHeight + 120);
      scrim.addColorStop(0, '#08080A');
      scrim.addColorStop(0.5, 'rgba(8, 8, 10, 0.85)');
      scrim.addColorStop(1, 'rgba(8, 8, 10, 0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, headerHeight - 80, width, 200);

      // 底部シネマシャドウ
      const bottomScrim = ctx.createLinearGradient(0, height - 250, 0, height);
      bottomScrim.addColorStop(0, 'rgba(8, 8, 10, 0)');
      bottomScrim.addColorStop(1, 'rgba(8, 8, 10, 0.95)');
      ctx.fillStyle = bottomScrim;
      ctx.fillRect(0, height - 250, width, 250);

      ctx.restore();
    } catch (e) {
      console.warn('Cover image render fallback', e);
    }
  }

  // 2. 最上部ヘッダー（特大インフォグラフィック看板プレート）
  ctx.save();
  
  // 看板ベースプレート（グラスモーフィズム高級パネル）
  const panelGrad = ctx.createLinearGradient(0, 0, 0, headerHeight);
  if (isMv) {
    panelGrad.addColorStop(0, '#0D0814');
    panelGrad.addColorStop(1, '#1A0E2E');
  } else if (isHist) {
    panelGrad.addColorStop(0, '#120A05');
    panelGrad.addColorStop(1, '#24140A');
  } else if (isTrivia) {
    panelGrad.addColorStop(0, '#04101A');
    panelGrad.addColorStop(1, '#082033');
  } else if (isManzai) {
    panelGrad.addColorStop(0, '#1A0808');
    panelGrad.addColorStop(1, '#2E1010');
  } else {
    panelGrad.addColorStop(0, '#0D0D12');
    panelGrad.addColorStop(1, '#181822');
  }
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 0, width, headerHeight);

  // 金・銀・ネオンの装飾アクセントボーダー（下部境界ライン）
  const borderGrad = ctx.createLinearGradient(0, 0, width, 0);
  if (isMv) {
    borderGrad.addColorStop(0, '#FF0055');
    borderGrad.addColorStop(0.5, '#A855F7');
    borderGrad.addColorStop(1, '#00F0FF');
  } else if (isHist) {
    borderGrad.addColorStop(0, '#785A28');
    borderGrad.addColorStop(0.5, '#F59E0B');
    borderGrad.addColorStop(1, '#785A28');
  } else if (isTrivia) {
    borderGrad.addColorStop(0, '#0EA5E9');
    borderGrad.addColorStop(0.5, '#38BDF8');
    borderGrad.addColorStop(1, '#0284C7');
  } else {
    borderGrad.addColorStop(0, '#E5E7EB');
    borderGrad.addColorStop(0.5, '#6366F1');
    borderGrad.addColorStop(1, '#E5E7EB');
  }
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, headerHeight - 4, width, 4);

  // 3. 看板内テキストのレイアウト（超ド迫力・完全被りゼロ）
  
  // A. トップバッジ（話数 または ジャンルバッジ）
  const badgeY = 70;
  const epLabel = isMv 
    ? '🎵 OFFICIAL MUSIC VIDEO' 
    : isTrivia 
    ? '💡 歴史・雑学アカデミー' 
    : isManzai 
    ? '🎙️ 爆笑！上方・江戸寄席' 
    : isHist 
    ? `🏮 時代劇長編大作 [第${ep.id}幕]` 
    : `🎬 STUDIO PRO PRODUCTION [EPISODE ${ep.id}]`;

  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = isMv ? '#E879F9' : isHist ? '#FBBF24' : isTrivia ? '#38BDF8' : '#A5B4FC';
  ctx.fillText(epLabel, width / 2, badgeY);

  // B. メインタイトル（超極太・大迫力2行折り返し対応）
  const cleanEpTitle = cleanTitle(ep.titleJp || '無題');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  let titleFontSize = 68;
  if (cleanEpTitle.length > 18) titleFontSize = 54;
  if (cleanEpTitle.length > 26) titleFontSize = 46;
  ctx.font = `900 ${titleFontSize}px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;

  // タイトルが長い場合はスマート2行分割
  const maxTitleWidth = width - 120;
  if (ctx.measureText(cleanEpTitle).width > maxTitleWidth && cleanEpTitle.length > 8) {
    const mid = Math.ceil(cleanEpTitle.length / 2);
    // 助詞や句読点付近で切る配慮（簡易）
    const line1 = cleanEpTitle.slice(0, mid);
    const line2 = cleanEpTitle.slice(mid);
    ctx.fillText(line1, width / 2, 175);
    ctx.fillText(line2, width / 2, 175 + titleFontSize + 12);
  } else {
    ctx.fillText(cleanEpTitle, width / 2, 200);
  }

  // C. 英語サブタイトル
  if (ep.titleEn) {
    ctx.font = '600 22px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.shadowBlur = 4;
    ctx.fillText(ep.titleEn.toUpperCase(), width / 2, 275);
  }

  // D. キャッチコピー大型リボン（帯プレート）
  const catchphrase = ep.coverCatchphraseJp || ep.summary?.slice(0, 36) || '時代を駆け抜けた魂の物語';
  const ribbonY = 320;
  const ribbonH = 76;
  const ribbonW = width - 100;
  const ribbonX = (width - ribbonW) / 2;

  // リボン背景
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  
  const ribbonGrad = ctx.createLinearGradient(ribbonX, ribbonY, ribbonX + ribbonW, ribbonY);
  if (isMv) {
    ribbonGrad.addColorStop(0, '#BE185D');
    ribbonGrad.addColorStop(1, '#6D28D9');
  } else if (isHist) {
    ribbonGrad.addColorStop(0, '#B45309');
    ribbonGrad.addColorStop(1, '#78350F');
  } else if (isTrivia) {
    ribbonGrad.addColorStop(0, '#0369A1');
    ribbonGrad.addColorStop(1, '#0C4A6E');
  } else {
    ribbonGrad.addColorStop(0, '#4338CA');
    ribbonGrad.addColorStop(1, '#1E1B4B');
  }
  ctx.fillStyle = ribbonGrad;
  
  // 角丸四角形
  const r = 16;
  ctx.beginPath();
  ctx.moveTo(ribbonX + r, ribbonY);
  ctx.lineTo(ribbonX + ribbonW - r, ribbonY);
  ctx.quadraticCurveTo(ribbonX + ribbonW, ribbonY, ribbonX + ribbonW, ribbonY + r);
  ctx.lineTo(ribbonX + ribbonW, ribbonY + ribbonH - r);
  ctx.quadraticCurveTo(ribbonX + ribbonW, ribbonY + ribbonH, ribbonX + ribbonW - r, ribbonY + ribbonH);
  ctx.lineTo(ribbonX + r, ribbonY + ribbonH);
  ctx.quadraticCurveTo(ribbonX, ribbonY + ribbonH, ribbonX, ribbonY + ribbonH - r);
  ctx.lineTo(ribbonX, ribbonY + r);
  ctx.quadraticCurveTo(ribbonX, ribbonY, ribbonX + r, ribbonY);
  ctx.closePath();
  ctx.fill();

  // リボン枠線
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();
  ctx.restore();

  // キャッチコピー文字
  ctx.font = 'bold 30px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(`“ ${catchphrase} ”`, width / 2, ribbonY + 48);

  // E. メタデータタグ群（時代・テーマ・テイスト）
  const tagsY = 440;
  const tags: string[] = [];
  if (ep.era) tags.push(ep.era);
  if (ep.theme) tags.push(ep.theme);
  if (ep.taste) tags.push(ep.taste);
  if (isMv) tags.push('4K CINEMATIC MV');

  if (tags.length > 0) {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    const tagString = tags.map(t => `#${t}`).join('   •   ');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(tagString, width / 2, tagsY);
  }

  // 4. 最下部フッター（ブランド透かし ＆ 著作権表示）
  ctx.font = '600 18px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.textAlign = 'center';
  ctx.fillText('STUDIO PRO PRODUCTION  |  ULTRA DIRECT CINEMA', width / 2, height - 35);
  ctx.restore();

  return canvas;
}

/**
 * 扉絵をBase64文字列（PNG）として取得
 */
export async function renderCoverBase64(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvas(ep);
  try {
    if (canvas instanceof OffscreenCanvas) {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split('base64,').pop() || res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const res = (canvas as HTMLCanvasElement).toDataURL('image/png');
      return res.split('base64,').pop() || res;
    }
  } finally {
    if (canvas instanceof OffscreenCanvas) {
      const coverCtx = canvas.getContext('2d');
      if (coverCtx) coverCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    } else {
      const cvs = canvas as HTMLCanvasElement;
      const coverCtx = cvs.getContext('2d');
      if (coverCtx) coverCtx.clearRect(0, 0, cvs.width, cvs.height);
      cvs.width = 0;
      cvs.height = 0;
    }
  }
}
