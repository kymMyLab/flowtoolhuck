import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@v2.8.8-anti-previous-cut-shield-and-pose-dedup/dist/bundle.js').then(m => {
  const root = document.getElementById('root') || document.body;
  root.innerHTML = '';
  m.mount(root);
  console.log('🚀 STUDIO PRO 最新版マウント完了！[v2.8.8: 🛡️ 手前Cutネガティブ完全注入＆ポーズ重複ゼロ化]');
});
