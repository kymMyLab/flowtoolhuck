import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@v2.9.0-taste-showroom-expansion-and-modular-refactor/dist/bundle.js').then(m => {
  const root = document.getElementById('root') || document.body;
  root.innerHTML = '';
  m.mount(root);
  console.log('🚀 STUDIO PRO 最新版マウント完了！[v2.9.0: 🎨 画風ショールーム+10種30作例完全登録 ＆ 🧩 モジュール分割リファクタリング完了]');
});
