import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

// Material Symbols フォントの動的注入（Flow Tools iframe内でのアイコン表示を保証）
function ensureMaterialIcons() {
  if (typeof document === 'undefined') return;
  const FONT_ID = 'flowtool-material-symbols';
  if (!document.getElementById(FONT_ID)) {
    const link = document.createElement('link');
    link.id = FONT_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    document.head.appendChild(link);
  }
}

/**
 * Google Flow Tools の iframe 内に存在する importmap から
 * flow-sdk を動的インポートして window.Flow へ自動代入する
 */
export async function ensureFlowSDK(): Promise<any> {
  if (typeof window === 'undefined') return null;

  if ((window as any).Flow) {
    return (window as any).Flow;
  }

  try {
    const moduleName = 'flow-sdk';
    const flowModule = await import(/* @vite-ignore */ moduleName);
    const resolvedFlow = flowModule.Flow || flowModule.default || flowModule;
    (window as any).Flow = resolvedFlow;
    console.log('✅ [FlowTool] Auto-bound window.Flow successfully from importmap:', resolvedFlow);
    return resolvedFlow;
  } catch (err) {
    console.warn('⚠️ [FlowTool] Could not load flow-sdk natively from importmap, keeping shim fallback:', err);
    return null;
  }
}

// バンドルが読み込まれた時点で直ちに自動バインドを試みる
if (typeof window !== 'undefined') {
  ensureFlowSDK();
}

let reactRoot: ReactDOM.Root | null = null;
let currentContainer: HTMLElement | null = null;

/**
 * FlowTool React アプリケーションをターゲットDOMにマウントする
 * @param targetElement マウント先DOM要素 (省略時は #root または document.body)
 */
export async function mount(targetElement?: HTMLElement | null): Promise<{ unmount: () => void }> {
  // 1. Flow SDK の自動解決・バインドを待機
  await ensureFlowSDK();

  // 2. フォントの注入
  ensureMaterialIcons();

  // 3. マウント先コンテナの解決
  const container = targetElement || document.getElementById('root') || document.body;
  if (!container) {
    console.error('[FlowTool] Target container could not be found to mount the application.');
    return { unmount: () => {} };
  }

  // 既にマウント済みの場合は再利用またはクリーンアップ
  if (reactRoot && currentContainer === container) {
    console.log('[FlowTool] Already mounted on this container. Re-rendering...');
    reactRoot.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    return { unmount };
  }

  if (reactRoot) {
    try {
      reactRoot.unmount();
    } catch (e) {
      console.warn('[FlowTool] Previous root unmount warning:', e);
    }
    reactRoot = null;
  }

  currentContainer = container;
  reactRoot = ReactDOM.createRoot(container);
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  console.log('🚀 [FlowTool] Mounted successfully into target container:', container);
  console.log('💡 FlowTool Studio Pro がスタンバイしました。左サイドバーの「全自動プロデュース開始」をクリックして制作を開始してください。');
  return { unmount };
}

/**
 * アプリケーションのアンマウント
 */
export function unmount() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
    currentContainer = null;
    console.log('[FlowTool] Unmounted successfully.');
  }
}

// グローバル参照としても登録
if (typeof window !== 'undefined') {
  (window as any).FlowTool = {
    mount,
    unmount,
    ensureFlowSDK,
    version: '1.1.0',
    App
  };
}

export { App };
export default { mount, unmount, ensureFlowSDK, App };
