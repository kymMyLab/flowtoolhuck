/**
 * Google Flow Tool Webプロジェクト コード一括抽出・ダウンロード呪文 (V2 完全版)
 * 
 * 【使い方】
 * 1. Flow Tool 画面の左上タブが「コード」になっていることを確認
 * 2. Chrome DevTools (F12) を開き、「Console」タブを選択
 * 3. Console 左上のドロップダウンが「top」になっていることを確認
 * 4. 本スクリプトをまるごと貼り付けて Enter を押す
 * 
 * 【実行結果】
 * - 自動的に全ファイルツリーを巡回クリック
 * - 全20ファイルのソースコードを多重スコープ（iframe / ShadowDOM / Monaco / DOM）から吸い上げ
 * - 「FlowTool_WebProject_Code.txt」として自動ダウンロード
 * - クリップボードにも全コードを自動コピー
 */

(async function grabAllFlowToolCodeV2() {
  console.log('%c🚀 [FlowTool Code Collector V2] 全スコープ走査型コード抽出を開始します...', 'color: #3b82f6; font-size: 14px; font-weight: bold;');

  const targetWin = window.top || window;
  const targetDoc = targetWin.document;
  const collected = [];

  // 1. ファイルツリーの全項目を特定（既知ファイルおよび拡張子マッチ）
  const knownKeywords = [
    'types.ts', 'constants.ts', 'StudioSidebar', 'EpisodeSection', 'App.tsx',
    'CutCard', 'CutInspector', 'utils.ts', 'promptEngine', 'directorService',
    'coverService', 'CoverPreview', 'zipPackager', 'seriesProduction',
    'useStudioProduct', 'MediaPreview'
  ];

  const getClickableFiles = () => {
    const list = [];
    const allEls = Array.from(targetDoc.querySelectorAll('*'));
    
    for (const kw of knownKeywords) {
      let matchedEl = null;
      for (const el of allEls) {
        const text = (el.innerText || '').trim();
        const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
        if ((text && text.includes(kw)) || (title && title.includes(kw))) {
          if (text.length < 80 && !text.includes('\n')) {
            matchedEl = el.closest('button') || el.closest('[role="treeitem"]') || el.parentElement || el;
            break;
          }
        }
      }
      if (matchedEl) list.push({ keyword: kw, el: matchedEl });
    }

    for (const el of allEls) {
      if (el.children.length === 0) {
        const t = (el.innerText || '').trim();
        const title = el.getAttribute('title') || '';
        const name = title || t;
        if (/\.(tsx?|json|css)\b/i.test(name) && name.length < 60 && !name.includes('\n')) {
          if (!list.some(item => name.includes(item.keyword) || item.keyword.includes(name))) {
            const clickable = el.closest('button') || el.closest('[role="treeitem"]') || el.parentElement || el;
            list.push({ keyword: name, el: clickable });
          }
        }
      }
    }
    return list;
  };

  const filesToProcess = getClickableFiles();
  console.log('%c📋 検出されたファイル一覧 (' + filesToProcess.length + ' 件):', 'color: #8b5cf6;', filesToProcess.map(f => f.keyword));

  // 2. すべてのスコープ (Document, iframes, ShadowRoots) を再帰収集
  function getAllScopes(rootDoc) {
    const scopes = [];
    const queue = [rootDoc];
    const visited = new Set();
    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr || visited.has(curr)) continue;
      visited.add(curr);
      scopes.push(curr);
      try {
        const els = curr.querySelectorAll ? curr.querySelectorAll('*') : [];
        for (const el of els) {
          if (el.shadowRoot && !visited.has(el.shadowRoot)) queue.push(el.shadowRoot);
          if (el.tagName === 'IFRAME') {
            try {
              const ifrDoc = el.contentDocument || (el.contentWindow && el.contentWindow.document);
              if (ifrDoc && !visited.has(ifrDoc)) queue.push(ifrDoc);
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    return scopes;
  }

  // 3. 全スコープからコードを吸い出す
  function extractCodeFromAllScopes(scopes) {
    for (const s of scopes) {
      const vl = s.querySelector('.view-lines');
      if (vl && vl.innerText && vl.innerText.trim().length > 10) {
        return { type: 'monaco-view-lines', text: vl.innerText };
      }
    }

    for (const s of scopes) {
      const lines = Array.from(s.querySelectorAll('.view-line'));
      if (lines.length > 0) {
        const text = lines.map(l => l.innerText).join('\n');
        if (text.trim().length > 10) return { type: 'monaco-view-line-array', text: text };
      }
    }

    for (const s of scopes) {
      try {
        const win = s.defaultView || (s.ownerDocument && s.ownerDocument.defaultView);
        if (win && win.monaco && win.monaco.editor) {
          const models = win.monaco.editor.getModels();
          if (models.length > 0) {
            const last = models[models.length - 1];
            if (last && last.getValue) {
              const val = last.getValue();
              if (val && val.trim().length > 10) return { type: 'monaco-model', text: val };
            }
          }
        }
      } catch (e) {}
    }

    for (const s of scopes) {
      const cm = s.querySelector('.cm-content, .CodeMirror-code, pre code, pre');
      if (cm && cm.innerText && cm.innerText.trim().length > 10) {
        return { type: 'pre-or-cm', text: cm.innerText };
      }
    }

    for (const s of scopes) {
      const divs = Array.from(s.querySelectorAll('div, section, main'));
      for (const d of divs) {
        const t = d.innerText || '';
        if ((t.includes('import ') || t.includes('export ') || t.includes('function ')) && t.length > 50) {
          if (!t.includes('StudioSidebar') || !t.includes('CutCard')) {
            const hasChildCode = Array.from(d.children).some(c => (c.innerText || '').includes('import ') && (c.innerText || '').length > 50);
            if (!hasChildCode) return { type: 'inner-dom-code', text: t };
          }
        }
      }
    }

    return null;
  }

  // 4. 順次クリック＆全スコープ抽出ループ
  for (let i = 0; i < filesToProcess.length; i++) {
    const item = filesToProcess[i];
    console.log('%c[' + (i + 1) + '/' + filesToProcess.length + '] クリック中: ' + item.keyword, 'color: #f59e0b;');
    
    try {
      item.el.click();
    } catch (e) {}

    await new Promise(r => setTimeout(r, 600));

    const scopes = getAllScopes(targetDoc);
    const result = extractCodeFromAllScopes(scopes);

    if (result && result.text && result.text.trim().length > 5) {
      collected.push({ name: item.keyword, code: result.text });
      console.log('%c✔ 回収成功: ' + item.keyword + ' (方法: ' + result.type + ', ' + result.text.length + '文字)', 'color: #10b981;');
    } else {
      console.warn('⚠ 取得スキップ: ' + item.keyword + ' (検出スコープ数: ' + scopes.length + ')');
    }
  }

  // 5. 結果の出力・保存
  console.log('%c========================================', 'color: #10b981;');
  console.log('%c🎉 抽出完了！ 合計 ' + collected.length + ' ファイルのコードを取得しました', 'color: #10b981; font-size: 15px; font-weight: bold;');
  console.log('%c========================================', 'color: #10b981;');

  if (collected.length === 0) {
    console.error('❌ コードが取得できませんでした。');
    return;
  }

  let fullBundleText = '// ========================================================\n';
  fullBundleText += '// Flow Tool Web Project Complete Source Dump\n';
  fullBundleText += '// Export Date: ' + new Date().toISOString() + '\n';
  fullBundleText += '// Total Files: ' + collected.length + '\n';
  fullBundleText += '// ========================================================\n\n';

  for (const file of collected) {
    fullBundleText += '/* ========================================================\n';
    fullBundleText += '   FILE: ' + file.name + '\n';
    fullBundleText += '======================================================== */\n';
    fullBundleText += file.code + '\n\n';
  }

  // テキストファイル自動ダウンロード
  try {
    const blob = new Blob([fullBundleText], { type: 'text/plain;charset=utf-8' });
    const a = targetDoc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'FlowTool_WebProject_Code.txt';
    targetDoc.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    console.log('%c💾 [ダウンロード完了] FlowTool_WebProject_Code.txt を保存しました！', 'color: #10b981; font-weight: bold;');
  } catch (e) {}

  // クリップボード自動コピー
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullBundleText);
      console.log('%c📋 [クリップボード完了] 全コードをクリップボードにコピーしました！', 'color: #3b82f6; font-weight: bold;');
    }
  } catch (e) {}

  console.log('%c🎉 全作業が完了しました！ダウンロードされたテキスト、またはクリップボードの中身をご確認ください。', 'color: #10b981; font-size: 14px; font-weight: bold;');
})();

