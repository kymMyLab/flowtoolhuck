import('https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@c32d328/dist/bundle.js').then(m => {
    const root = document.getElementById('root') || document.body;
    root.innerHTML = '';
    m.mount(root);
});
