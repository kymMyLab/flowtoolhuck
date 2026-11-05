/**
 * directorTextHelpers.ts
 * 映画監督・シナリオ生成に関わるテキスト整形・抽出・サニタイズなどの純粋関数群
 */

/**
 * エピソードタイトルから話数連番（第1話、第一話、第１話、Episode 1、Track 1、Vol.1等）を徹底除去。
 * 理由: ユーザーが途中の話を削除・スキップ・並び替えした際に「とび番（欠番）」になる事故を完全に防ぎ、
 * 各エピソードを独立した魅力的なサブタイトルとして自立させるため。
 */
export function cleanEpisodeTitle(title: string): string {
  if (!title) return '';
  return title
    // 絵文字プレフィックス等の除去
    .replace(/^[\s🎵🎬💡🏮🎨⚓🖼️✨🔥\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]+/g, '')
    // 【第1話】のような角括弧
    .replace(/^【.*?】\s*/, '')
    // 先頭の「第1話：」「第１話:」「第一話 -」「Episode 1:」「Ep.1:」「Track 1:」「Vol.1:」「Part 1:」などの接頭辞
    .replace(/^(第\s*[\d０-９一二三四五六七八九十百千]+\s*[話曲章幕弾節巻]|Episode\s*[\d０-９一二三四五六七八九十百千]+|Ep\.\s*\d+|Track\s*\d+|Vol\.\s*\d+|Part\s*\d+|Chapter\s*\d+)[:：\s・\-ー]*/i, '')
    // 文字列中の「第○話：」「第2話」などの連番も全域除去
    .replace(/(第\s*[\d０-９一二三四五六七八九十百千]+\s*[話曲章幕弾節巻]|Episode\s*[\d０-９一二三四五六七八九十百千]+|Ep\.\s*\d+|Track\s*\d+|Vol\.\s*\d+|Part\s*\d+|Chapter\s*\d+)[:：\s・\-ー]*/gi, '')
    // 括弧内の連番「(第1話)」「(Vol.1)」等
    .replace(/[\(（【\[]\s*(第\s*[\d０-９一二三四五六七八九十百千]+\s*[話曲章幕弾節巻]|Episode\s*\d+|Vol\.\d+|Track\s*\d+)\s*[\)）】\]]/gi, '')
    // 括弧内の起承転結タグ「（起・承）」「（転・結）」「（起）」「（承）」「（転）」「（結）」等
    .replace(/[\(（【\[]\s*[起承転結・\s]+\s*[\)）】\]]/gi, '')
    // 囲み鉤括弧の除去
    .replace(/^[「『](.*?)[」』]$/, '$1')
    .trim();
}

export function cleanEpisodeTitleEn(title: string): string {
  if (!title) return '';
  return title
    .replace(/^(Episode\s*[\d０-９一二三四五六七八九十百千]+|Ep\.\s*\d+|Track\s*\d+|Vol\.\s*\d+|Part\s*\d+|Chapter\s*\d+)[:：\s・\-ー]*/i, '')
    .replace(/[\(（【\[]\s*(Episode\s*\d+|Vol\.\d+|Track\s*\d+)\s*[\)）】\]]\s*$/i, '')
    .trim();
}

/**
 * 舞台設定が歴史・時代劇かどうかを判定（時代・テーマ双方から判定）
 */
export function checkIsHistorical(era: string = '', theme: string = ''): boolean {
  const combined = `${era} ${theme}`;
  // 現代・近過去・SNS・現代ビジネス系は非歴史
  if (
    combined.includes('現代') || 
    combined.includes('令和') || 
    combined.includes('平成') || 
    combined.includes('バブル') || 
    combined.includes('SNS') || 
    combined.includes('ブラック企業') || 
    combined.includes('社内不倫') || 
    combined.includes('タワマン') || 
    combined.includes('推し活') || 
    combined.includes('マッチングアプリ')
  ) {
    return false;
  }
  // 歴史・時代劇キーワード
  return (
    combined.includes('江戸') || combined.includes('幕末') || combined.includes('明治') || 
    combined.includes('大正') || combined.includes('戦後') || combined.includes('昭和') || 
    combined.includes('戦国') || combined.includes('平安') || combined.includes('鎌倉') || 
    combined.includes('室町') || combined.includes('安土桃山') || combined.includes('古代') || 
    combined.includes('中世') || combined.includes('大河') || combined.includes('吉原') || 
    combined.includes('新選組') || combined.includes('浪人') || combined.includes('大名') || 
    combined.includes('武士') || combined.includes('侍') || combined.includes('寺子屋') || 
    combined.includes('飛脚') || combined.includes('岡っ引き') || combined.includes('火消し') ||
    combined.includes('屋台めし') || combined.includes('薬売り') || combined.includes('鉄火場') ||
    combined.includes('鼠小僧')
  );
}

/**
 * ナレーションから強調すべき重要キーワード（2〜4文字の漢字熟語等）を抽出・確定
 * （AIやユーザー指定の単語を優先し、本文に実在する単語だけを厳密に採用。空なら本文から自動抽出して確実に色付けを点灯させる）
 */
export function extractHighlights(narrationText: string, suggestedWords: string[] = []): Array<{ word: string; color: string; sizeScale: number }> {
  if (!narrationText || !narrationText.trim()) return [];
  const validHighlights: Array<{ word: string; color: string; sizeScale: number }> = [];

  const neonColors = ['#FFE600', '#00F0FF', '#FF2A85', '#39FF14', '#FF7A00', '#BD00FF'];

  // 1. 指定された単語のうち、ナレーション本文に確実に含まれているものを採用
  for (const rawWord of suggestedWords) {
    const word = (rawWord || '').trim();
    if (word && narrationText.includes(word) && word.length >= 1 && word.length <= 8) {
      if (!validHighlights.some(h => h.word === word)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  // 2. 複合熟語（「三種の神器」「風の谷」などの 漢字＋の＋漢字）を優先検索
  if (validHighlights.length === 0) {
    const compoundMatches = narrationText.match(/[\u4e00-\u9faf]{1,3}の[\u4e00-\u9faf]{1,3}/g);
    if (compoundMatches && compoundMatches.length > 0) {
      for (const word of Array.from(new Set(compoundMatches)).slice(0, 2)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  // 3. 漢字熟語（2〜4文字）を抽出
  if (validHighlights.length === 0) {
    const kanjiMatches = narrationText.match(/[\u4e00-\u9faf]{2,4}/g);
    if (kanjiMatches && kanjiMatches.length > 0) {
      const candidates = Array.from(new Set(kanjiMatches)).filter(w => w.length >= 2 && w.length <= 4);
      for (const word of candidates.slice(0, 2)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  // 4. カタカナ単語（2〜6文字）
  if (validHighlights.length === 0) {
    const katakanaMatches = narrationText.match(/[\u30a1-\u30f6]{2,6}/g);
    if (katakanaMatches && katakanaMatches.length > 0) {
      for (const word of Array.from(new Set(katakanaMatches)).slice(0, 2)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  return validHighlights;
}

/**
 * YouTube広告ガイドライン・アルゴリズムに配慮したセーフワードサニタイザー
 * 露骨な下品語・身体排出物・過度なグロ表現を学術・歴史用語や安全な表現へ自動置換
 */
export function sanitizeForYouTubeSafety(text: string): string {
  if (!text) return '';
  return text
    .replace(/うんち|うんこ/g, '下肥')
    .replace(/人糞/g, '下肥')
    .replace(/糞尿/g, '排泄物')
    .replace(/下痢便/g, '赤痢')
    .replace(/下痢/g, '激しい腹痛')
    .replace(/死体/g, '遺骸')
    .replace(/惨殺/g, '討死');
}
