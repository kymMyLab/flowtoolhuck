import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@0c24f1a/dist/bundle.js').then(m => {
    const root = document.getElementById('root') || document.body;
    root.innerHTML = '';
    m.mount(root);
});
