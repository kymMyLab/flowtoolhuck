import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@v2.8.2-scene-context-ready/dist/bundle.js').then(m => {
    const root = document.getElementById('root') || document.body;
    root.innerHTML = '';
    m.mount(root);
    console.log('🚀 STUDIO PRO 最新版マウント完了！[v2.8.2: 🎯 情景＆アオハル完全対応版]');
});
