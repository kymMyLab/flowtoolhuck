/**
 * Google Flow Tool Webプロジェクト コード一括抽出・ダウンロード呪文 (V3 超強化版)
 * 
 * 【改善点 (V3)】
 * - チャット履歴・メッセージ領域の <pre> 誤爆を完全遮断（ブラックリスト除外）
 * - 自動で「コード」タブを検知して最前面にアクティブ化
 * - Monaco Editor (.monaco-editor) コンテナ内のみを厳格走査
 * - 画面上の同一テキスト連続取得（重複取得）を検知し自動リトライ
 * - 万が一エディタが見つからない場合の詳細な診断メッセージを出力
 * 
 * 【使い方】
 * 1. Flow Tool 画面の左上タブが「コード」になっていることを確認
 * 2. Chrome DevTools (F12) を開き、「Console」タブを選択
 * 3. Console 左上のドロップダウンが「top」になっていることを確認
 * 4. 本スクリプトをまるごと貼り付けて Enter を押す
 */

(async function grabAllFlowToolCodeV3() {
  console.log('%c🚀 [FlowTool Code Collector V3] 超高精度コード抽出を開始します...', 'color: #3b82f6; font-size: 15px; font-weight: bold;');

  const targetWin = window.top || window;
  const targetDoc = targetWin.document;
  const collected = [];

  // 0. チャット領域・メッセージ領域の誤爆判定フィルター
  function isInsideChat(el) {
    if (!el || !el.closest) return false;
    return !!el.closest('.chat, [class*="chat" i], [class*="message" i], [class*="conversation" i], [class*="prompt" i], [aria-label*="chat" i], [aria-label*="チャット" i]');
  }

  // 1. 自動で「コード」タブを探してアクティブ化
  console.log('%c🔍 画面タブの状態を確認中...', 'color: #8b5cf6;');
  const allTabs = Array.from(targetDoc.querySelectorAll('button, [role="tab"], div, span'));
  for (const tab of allTabs) {
    const t = (tab.innerText || '').trim();
    if ((t === 'コード' || t === 'Code' || t === 'Files') && !isInsideChat(tab) && tab.offsetHeight > 0) {
      console.log('%c📁 「コード」タブを発見。最前面に切り替えます...', 'color: #3b82f6;');
      try { tab.click(); } catch(e) {}
      await new Promise(r => setTimeout(r, 800));
      break;
    }
  }

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

  // 3. ファイルツリーの全項目を特定（既知ファイルおよび拡張子マッチ）
  const knownKeywords = [
    'types.ts', 'constants.ts', 'StudioSidebar', 'EpisodeSection', 'App.tsx',
    'CutCard', 'CutInspector', 'utils.ts', 'promptEngine', 'directorService',
    'coverService', 'CoverPreview', 'zipPackager', 'seriesProduction',
    'useStudioProduct', 'MediaPreview'
  ];

  const getClickableFiles = () => {
    const list = [];
    const allEls = Array.from(targetDoc.querySelectorAll('*'));
    
    // キーワードに合致する要素を探索（チャット欄は除外）
    for (const kw of knownKeywords) {
      let matchedEl = null;
      for (const el of allEls) {
        if (isInsideChat(el)) continue;
        const text = (el.innerText || '').trim();
        const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
        if ((text && text.includes(kw)) || (title && title.includes(kw))) {
          if (text.length < 80 && !text.includes('\n')) {
            matchedEl = el.closest('button') || el.closest('[role="treeitem"]') || el.closest('li') || el.parentElement || el;
            break;
          }
        }
      }
      if (matchedEl) list.push({ keyword: kw, el: matchedEl });
    }

    // 未知のファイル（新しく追加されたファイルなど）も捕捉
    for (const el of allEls) {
      if (isInsideChat(el)) continue;
      if (el.children.length === 0) {
        const t = (el.innerText || '').trim();
        const title = el.getAttribute('title') || '';
        const name = title || t;
        if (/\.(tsx?|json|css)\b/i.test(name) && name.length < 60 && !name.includes('\n')) {
          if (!list.some(item => name.includes(item.keyword) || item.keyword.includes(name))) {
            const clickable = el.closest('button') || el.closest('[role="treeitem"]') || el.closest('li') || el.parentElement || el;
            list.push({ keyword: name, el: clickable });
          }
        }
      }
    }
    return list;
  };

  const filesToProcess = getClickableFiles();
  console.log('%c📋 検出されたファイル一覧 (' + filesToProcess.length + ' 件):', 'color: #8b5cf6;', filesToProcess.map(f => f.keyword));

  if (filesToProcess.length === 0) {
    console.error('❌ ファイルツリーが見つかりませんでした。「コード」タブが開かれているかご確認ください。');
    return;
  }

  // 4. Monaco エディタから厳格にコードを抽出する関数
  function extractCodeFromEditor(scopes) {
    // A: Monaco の .view-lines（最も確実）
    for (const s of scopes) {
      const vls = Array.from(s.querySelectorAll('.monaco-editor .view-lines, .view-lines'));
      for (const vl of vls) {
        if (isInsideChat(vl)) continue;
        const t = vl.innerText || '';
        if (t.trim().length > 20 && !t.includes('hasRateLimitedBanana2Ref')) {
          return { type: 'monaco-view-lines', text: t };
        }
      }
    }

    // B: Monaco の .view-line 配列
    for (const s of scopes) {
      const editors = Array.from(s.querySelectorAll('.monaco-editor'));
      for (const ed of editors) {
        if (isInsideChat(ed)) continue;
        const lines = Array.from(ed.querySelectorAll('.view-line'));
        if (lines.length > 0) {
          const text = lines.map(l => l.innerText).join('\n');
          if (text.trim().length > 20 && !text.includes('hasRateLimitedBanana2Ref')) {
            return { type: 'monaco-view-line-array', text: text };
          }
        }
      }
    }

    // C: window.monaco モデル経由
    for (const s of scopes) {
      try {
        const win = s.defaultView || (s.ownerDocument && s.ownerDocument.defaultView);
        if (win && win.monaco && win.monaco.editor) {
          const models = win.monaco.editor.getModels();
          if (models.length > 0) {
            const last = models[models.length - 1];
            if (last && last.getValue) {
              const val = last.getValue();
              if (val && val.trim().length > 20 && !val.includes('hasRateLimitedBanana2Ref')) {
                return { type: 'monaco-model', text: val };
              }
            }
          }
        }
      } catch (e) {}
    }

    // D: CodeMirror やエディタコンテナ (.cm-content) ※チャット内は除外
    for (const s of scopes) {
      const cms = Array.from(s.querySelectorAll('.cm-content, .CodeMirror-code'));
      for (const cm of cms) {
        if (isInsideChat(cm)) continue;
        const t = cm.innerText || '';
        if (t.trim().length > 20 && !t.includes('hasRateLimitedBanana2Ref')) {
          return { type: 'codemirror', text: t };
        }
      }
    }

    // E: エディタコンテナ内部のテキスト
    for (const s of scopes) {
      const containers = Array.from(s.querySelectorAll('.editor-container, [data-keybinding-context], .monaco-editor'));
      for (const c of containers) {
        if (isInsideChat(c)) continue;
        const t = c.innerText || '';
        if (t.length > 100 && (t.includes('import ') || t.includes('export ') || t.includes('function ') || t.includes('{')) && !t.includes('hasRateLimitedBanana2Ref')) {
          return { type: 'editor-container-inner', text: t };
        }
      }
    }

    return null;
  }

  // 5. 順次クリック＆抽出ループ
  let lastText = '';
  for (let i = 0; i < filesToProcess.length; i++) {
    const item = filesToProcess[i];
    console.log('%c[' + (i + 1) + '/' + filesToProcess.length + '] クリック中: ' + item.keyword, 'color: #f59e0b;');
    
    // クリック実行（bubbles: true）
    try {
      item.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      item.el.click();
      item.el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    } catch (e) {}

    // エディタ描画待機
    await new Promise(r => setTimeout(r, 700));

    let scopes = getAllScopes(targetDoc);
    let result = extractCodeFromEditor(scopes);

    // もし直前と全く同一のテキストだった場合は、エディタ切り替え遅延の可能性があるためリトライ
    if (result && result.text === lastText && filesToProcess.length > 1) {
      console.warn('⏳ エディタ更新待機中... 500ms 追加待機');
      await new Promise(r => setTimeout(r, 500));
      scopes = getAllScopes(targetDoc);
      result = extractCodeFromEditor(scopes);
    }

    if (result && result.text && result.text.trim().length > 15) {
      lastText = result.text;
      collected.push({ name: item.keyword, code: result.text });
      console.log('%c✔ 回収成功: ' + item.keyword + ' (方法: ' + result.type + ', ' + result.text.length + '文字)', 'color: #10b981;');
    } else {
      console.warn('%c⚠ 取得失敗/スキップ: ' + item.keyword + ' (エディタ内に有効なコードが見つかりません)', 'color: #ef4444;');
    }
  }

  // 6. 結果の出力・保存
  console.log('%c========================================', 'color: #10b981;');
  console.log('%c🎉 抽出完了！ 合計 ' + collected.length + ' / ' + filesToProcess.length + ' ファイルのコードを取得しました', 'color: #10b981; font-size: 15px; font-weight: bold;');
  console.log('%c========================================', 'color: #10b981;');

  if (collected.length === 0) {
    console.error('❌ コードが1件も取得できませんでした。');
    console.info('💡 ヒント: Flow Tool 画面の左上タブが「コード」になっていること、および Console の左上が「top」になっていることをご確認ください。');
    return;
  }

  let fullBundleText = '// ========================================================\n';
  fullBundleText += '// Flow Tool Web Project Complete Source Dump (V3)\n';
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
