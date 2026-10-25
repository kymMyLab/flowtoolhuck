import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@489ee22/dist/bundle.js').then(m => {
    const root = document.getElementById('root') || document.body;
    root.innerHTML = '';
    m.mount(root);
});
