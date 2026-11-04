import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const REPO_SSH = 'git@github.com:kymMyLab/flowtoolhuck.git';
const BUNDLE_PATH = path.join(rootDir, 'dist', 'bundle.js');
const JSDELIVR_URL = 'https://cdn.jsdelivr.net/gh/kymMyLab/flowtoolhuck@main/dist/bundle.js';
const PURGE_URL = 'https://purge.jsdelivr.net/gh/kymMyLab/flowtoolhuck@main/dist/bundle.js';

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: rootDir, stdio: 'pipe', encoding: 'utf-8', ...options }).trim();
}

async function main() {
  console.log('====================================================');
  console.log('🚀 FlowTool One-Command Deploy Pipeline');
  console.log('====================================================\n');

  // 1. Build
  console.log('📦 Step 1: Building single ESM bundle with Vite...');
  try {
    const buildOutput = run('npm run build');
    console.log(buildOutput);
  } catch (err) {
    console.error('❌ Build failed:\n', err.stdout || err.message);
    process.exit(1);
  }

  // Check bundle.js
  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error('❌ dist/bundle.js was not generated!');
    process.exit(1);
  }
  const stat = fs.statSync(BUNDLE_PATH);
  const sizeKB = (stat.size / 1024).toFixed(1);
  console.log(`✅ Bundle ready: dist/bundle.js (${sizeKB} KB)\n`);

  // 2. Git setup & commit
  console.log('🔧 Step 2: Preparing Git commit...');
  let commitSha = '';
  try {
    // Configure user identity if needed
    try {
      run('git config user.name');
    } catch {
      run('git config user.name "kymMyLab"');
      run('git config user.email "flowtool@local"');
    }

    // Stage all files (including dist/bundle.js)
    run('git add -A');

    // Check status
    const status = run('git status --porcelain');
    if (!status) {
      console.log('ℹ️ No file changes detected to commit.');
    } else {
      const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      run(`git commit -m "Deploy FlowTool Bundle: ${timestamp}"`);
      console.log(`✅ Changes committed: "Deploy FlowTool Bundle: ${timestamp}"`);
    }

    // 最新コミットハッシュを記録した version.json および MOUNT_COMMAND.js を生成・コミット
    commitSha = run('git rev-parse HEAD').slice(0, 10);
    fs.writeFileSync(path.join(rootDir, 'dist', 'version.json'), JSON.stringify({ commit: commitSha, time: Date.now() }, null, 2));
    const mountCmd = `import('https://esm.sh/gh/kymMyLab/flowtoolhuck@${commitSha}/dist/bundle.js?raw').then(m => { const root = document.getElementById('root') || document.body; root.innerHTML = ''; m.mount(root); console.log('🚀 STUDIO PRO 完全最新版マウント完了！'); });\n`;
    fs.writeFileSync(path.join(rootDir, 'MOUNT_COMMAND.js'), mountCmd);
    run('git add dist/version.json MOUNT_COMMAND.js');
    run('git commit --amend --no-edit');
    commitSha = run('git rev-parse HEAD').slice(0, 10);
    fs.writeFileSync(path.join(rootDir, 'MOUNT_COMMAND.js'), `import('https://esm.sh/gh/kymMyLab/flowtoolhuck@${commitSha}/dist/bundle.js?raw').then(m => { const root = document.getElementById('root') || document.body; root.innerHTML = ''; m.mount(root); console.log('🚀 STUDIO PRO 完全最新版マウント完了！'); });\n`);
    console.log(`📌 Version pinned to commit: ${commitSha}`);

    // Push to GitHub
    console.log('\n📤 Step 3: Pushing to GitHub (origin/main)...');
    run('git push -u origin main --force');
    console.log('✅ Pushed successfully to GitHub!');
  } catch (err) {
    console.error('❌ Git operation failed:\n', err.stderr || err.stdout || err.message);
    process.exit(1);
  }

  // 3. Purge jsDelivr CDN cache
  console.log('\n🧹 Step 4: Purging jsDelivr CDN cache...');
  try {
    const res = await fetch(PURGE_URL);
    if (res.ok) {
      const data = await res.json();
      console.log('✅ jsDelivr CDN cache purged successfully!', data);
    } else {
      console.warn(`⚠️ jsDelivr purge returned HTTP status ${res.status}`);
    }
  } catch (err) {
    console.warn('⚠️ Could not purge jsDelivr cache automatically:', err.message);
  }

  // 4. Output snippet for user
  console.log('\n====================================================');
  console.log('🎉 Deployment Complete!');
  console.log('====================================================');
  console.log('\nPaste the following into your Google Flow Tools DevTools Console:');
  console.log('----------------------------------------------------');
  console.log(`import('https://esm.sh/gh/kymMyLab/flowtoolhuck@${commitSha}/dist/bundle.js?raw').then(m => { const root = document.getElementById('root') || document.body; root.innerHTML = ''; m.mount(root); console.log('🚀 STUDIO PRO 完全最新版マウント完了！'); });`);
  console.log('----------------------------------------------------\n');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
