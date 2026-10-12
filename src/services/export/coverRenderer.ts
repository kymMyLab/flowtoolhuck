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
 * 横型看板（16:9, 1920x1080）
 * YouTube通常動画サムネイル・Media Vault横型看板用
 * 左側にシネマインフォグラフィック看板、右側にキメ絵をシームレス融合配置
 */
export async function renderCoverCanvasHorizontal(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 1920;
  const height = 1080;
  const canvas = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Canvas context failed');

  // 世界観・モード判定
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const isHist = checkIsHistorical(ep.era, ep.theme);
  const mode = ep.productionMode || (isMv ? 'mv' : 'episodes');
  const combinedContext = `${ep.era || ''} ${ep.theme || ''} ${mode}`.toLowerCase();
  const isTrivia = mode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説');
  const isManzai = mode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席');

  // 背景ベース色
  ctx.fillStyle = '#08080A';
  ctx.fillRect(0, 0, width, height);

  // 1. 右側：キメ絵（またはマスターアンカー）を配置
  const cut1Base64 = ep.masterAnchorBase64 || ep.cuts[0]?.imageBase64;
  const textPanelWidth = 840; // 左側文字エリア幅

  if (cut1Base64) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed'));
        i.src = cut1Base64.startsWith('data:') ? cut1Base64 : `data:image/png;base64,${cut1Base64}`;
      });

      const imgTargetX = 640;
      const imgTargetW = width - imgTargetX;
      const imgScale = Math.max(imgTargetW / img.width, height / img.height);
      const scaledW = img.width * imgScale;
      const scaledH = img.height * imgScale;
      const imgOffsetX = imgTargetX + (imgTargetW - scaledW) / 2;
      const imgOffsetY = (height - scaledH) / 2;

      ctx.save();
      ctx.drawImage(img, imgOffsetX, imgOffsetY, scaledW, scaledH);

      // 左側文字エリアとのブレンド暗幕グラデーション（右向きフェード）
      const leftFade = ctx.createLinearGradient(imgTargetX - 100, 0, imgTargetX + 450, 0);
      leftFade.addColorStop(0, '#08080A');
      leftFade.addColorStop(0.4, 'rgba(8, 8, 10, 0.92)');
      leftFade.addColorStop(0.8, 'rgba(8, 8, 10, 0.4)');
      leftFade.addColorStop(1, 'rgba(8, 8, 10, 0)');
      ctx.fillStyle = leftFade;
      ctx.fillRect(imgTargetX - 100, 0, 550, height);

      // 上下シネマシャドウ
      const topBottomScrim = ctx.createLinearGradient(0, 0, 0, 160);
      topBottomScrim.addColorStop(0, 'rgba(8, 8, 10, 0.85)');
      topBottomScrim.addColorStop(1, 'rgba(8, 8, 10, 0)');
      ctx.fillStyle = topBottomScrim;
      ctx.fillRect(imgTargetX, 0, imgTargetW, 160);

      const btmScrim = ctx.createLinearGradient(0, height - 160, 0, height);
      btmScrim.addColorStop(0, 'rgba(8, 8, 10, 0)');
      btmScrim.addColorStop(1, 'rgba(8, 8, 10, 0.85)');
      ctx.fillStyle = btmScrim;
      ctx.fillRect(imgTargetX, height - 160, imgTargetW, 160);

      ctx.restore();
    } catch (e) {
      console.warn('Horizontal cover image render fallback', e);
    }
  }

  // 2. 左側：高級看板プレート（背景グラデーション）
  ctx.save();
  const panelGrad = ctx.createLinearGradient(0, 0, textPanelWidth, 0);
  if (isMv) {
    panelGrad.addColorStop(0, 'rgba(26, 14, 46, 0.98)');
    panelGrad.addColorStop(0.8, 'rgba(13, 8, 20, 0.95)');
    panelGrad.addColorStop(1, 'rgba(8, 8, 10, 0.9)');
  } else if (isHist) {
    panelGrad.addColorStop(0, 'rgba(36, 20, 10, 0.98)');
    panelGrad.addColorStop(0.8, 'rgba(18, 10, 5, 0.95)');
    panelGrad.addColorStop(1, 'rgba(8, 8, 10, 0.9)');
  } else if (isTrivia) {
    panelGrad.addColorStop(0, 'rgba(8, 32, 51, 0.98)');
    panelGrad.addColorStop(0.8, 'rgba(4, 16, 26, 0.95)');
    panelGrad.addColorStop(1, 'rgba(8, 8, 10, 0.9)');
  } else {
    panelGrad.addColorStop(0, 'rgba(24, 24, 34, 0.98)');
    panelGrad.addColorStop(0.8, 'rgba(13, 13, 18, 0.95)');
    panelGrad.addColorStop(1, 'rgba(8, 8, 10, 0.9)');
  }
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 0, textPanelWidth, height);

  // 境界アクセントライン
  const lineGrad = ctx.createLinearGradient(0, 0, 0, height);
  if (isMv) {
    lineGrad.addColorStop(0, '#FF0055');
    lineGrad.addColorStop(0.5, '#A855F7');
    lineGrad.addColorStop(1, '#00F0FF');
  } else if (isHist) {
    lineGrad.addColorStop(0, '#F59E0B');
    lineGrad.addColorStop(0.5, '#B45309');
    lineGrad.addColorStop(1, '#D97706');
  } else {
    lineGrad.addColorStop(0, '#6366F1');
    lineGrad.addColorStop(0.5, '#8B5CF6');
    lineGrad.addColorStop(1, '#EC4899');
  }
  ctx.fillStyle = lineGrad;
  ctx.fillRect(textPanelWidth - 4, 0, 4, height);

  // 3. 左側タイポグラフィレイアウト
  const leftMargin = 80;

  // A. モード＆エピソードバッジ
  ctx.save();
  const badgeY = 110;
  const badgeText = isMv ? '🎵 CINEMATIC MUSIC VIDEO' : isHist ? '📜 HISTORICAL DRAMA' : isTrivia ? '💡 KNOWLEDGE SHORTS' : isManzai ? '🎙️ COMEDY MANZAI' : '🎬 EPISODIC CINEMA';
  ctx.font = '900 18px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  ctx.fillStyle = isMv ? '#F43F5E' : isHist ? '#F59E0B' : '#818CF8';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(badgeText, leftMargin, badgeY);

  const epBadgeText = `EPISODE ${String(ep.id).padStart(2, '0')}`;
  ctx.font = '800 16px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`|   ${epBadgeText}`, leftMargin + ctx.measureText(badgeText).width + 20, badgeY);
  ctx.restore();

  // B. メインタイトル（特大・2行まで自動分割）
  ctx.save();
  const rawTitle = cleanTitle(ep.titleJp || '無題');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;

  let titleFontSize = 64;
  if (rawTitle.length > 18) titleFontSize = 48;
  else if (rawTitle.length > 12) titleFontSize = 54;
  ctx.font = `900 ${titleFontSize}px "Hiragino Mincho ProN", "Yu Mincho", serif`;

  const maxTitleW = textPanelWidth - leftMargin - 60;
  const titleY = 240;

  if (ctx.measureText(rawTitle).width <= maxTitleW) {
    ctx.fillText(rawTitle, leftMargin, titleY);
  } else {
    // 2行分割
    const mid = Math.ceil(rawTitle.length / 2);
    const line1 = rawTitle.slice(0, mid);
    const line2 = rawTitle.slice(mid);
    ctx.fillText(line1, leftMargin, titleY - 20);
    ctx.fillText(line2, leftMargin, titleY + titleFontSize + 5);
  }
  ctx.restore();

  // C. キャッチコピーリボン
  const catchphrase = ep.coverCatchphraseJp || ep.summary || '';
  if (catchphrase) {
    ctx.save();
    const ribbonY = 460;
    const ribbonH = 70;
    const ribbonW = textPanelWidth - leftMargin - 60;

    const rGrad = ctx.createLinearGradient(leftMargin, ribbonY, leftMargin + ribbonW, ribbonY);
    if (isMv) {
      rGrad.addColorStop(0, '#BE185D');
      rGrad.addColorStop(1, '#6D28D9');
    } else if (isHist) {
      rGrad.addColorStop(0, '#B45309');
      rGrad.addColorStop(1, '#78350F');
    } else {
      rGrad.addColorStop(0, '#4338CA');
      rGrad.addColorStop(1, '#1E1B4B');
    }
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.roundRect(leftMargin, ribbonY, ribbonW, ribbonH, 14);
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();

    ctx.font = 'bold 24px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    const cleanCatch = catchphrase.length > 28 ? catchphrase.slice(0, 27) + '…' : catchphrase;
    ctx.fillText(`“ ${cleanCatch} ”`, leftMargin + ribbonW / 2, ribbonY + 45);
    ctx.restore();
  }

  // D. メタデータタグ群
  ctx.save();
  const tagsY = 620;
  const tags: string[] = [];
  if (ep.era) tags.push(ep.era);
  if (ep.theme) tags.push(ep.theme);
  if (ep.taste) tags.push(ep.taste);
  if (isMv) tags.push('4K CINEMATIC MV');

  if (tags.length > 0) {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(tags.map(t => `#${t}`).join('   •   '), leftMargin, tagsY);
  }
  ctx.restore();

  // E. 最下部ブランド透かし
  ctx.save();
  ctx.font = '600 16px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('STUDIO PRO PRODUCTION  |  16:9 MASTER COVER', leftMargin, height - 60);
  ctx.restore();

  return canvas;
}

/**
 * 扉絵（縦型 9:16）をBase64文字列（PNG）として取得
 */
export async function renderCoverBase64(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvas(ep);
  return canvasToBase64(canvas);
}

/**
 * 扉絵（横型 16:9）をBase64文字列（PNG）として取得
 */
export async function renderCoverBase64Horizontal(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvasHorizontal(ep);
  return canvasToBase64(canvas);
}

async function canvasToBase64(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<string> {
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

