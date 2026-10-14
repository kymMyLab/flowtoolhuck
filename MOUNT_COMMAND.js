import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@v2.8.4-single-bundle-no-chunks/dist/bundle.js').then(m => {
  const root = document.getElementById('root') || document.body;
  root.innerHTML = '';
  m.mount(root);
  console.log('🚀 STUDIO PRO 最新版マウント完了！[v2.8.4: ⚡ 完全単一バンドル化・503エラー根絶版]');
});
