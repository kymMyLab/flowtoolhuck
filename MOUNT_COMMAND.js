import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@v2.8.7-taste-preview-enlarge-and-random-cover-theme/dist/bundle.js').then(m => {
  const root = document.getElementById('root') || document.body;
  root.innerHTML = '';
  m.mount(root);
  console.log('🚀 STUDIO PRO 最新版マウント完了！[v2.8.7: 🔍 画風プレビュー迫力超拡大 ＆ 🎲 サムネ配色15種ランダム選定]');
});
