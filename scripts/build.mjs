import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceDir = path.resolve(__dirname, '..');
const localBuildDir = path.join(os.homedir(), '.flowtool_build');

function log(msg) {
  console.log(`[Build Engine] ${msg}`);
}

// ファイル・ディレクトリの再帰コピー
function copySync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'scratch_repo') {
        continue;
      }
      copySync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

async function runBuild() {
  log('Preparing build on high-speed local storage...');

  if (!fs.existsSync(localBuildDir)) {
    fs.mkdirSync(localBuildDir, { recursive: true });
  }

  // 1. 同期対象のファイルとフォルダ
  const syncItems = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'tailwind.config.js',
    'postcss.config.js',
    'index.html',
    'src',
  ];

  for (const item of syncItems) {
    const srcPath = path.join(sourceDir, item);
    const destPath = path.join(localBuildDir, item);
    if (fs.existsSync(srcPath)) {
      copySync(srcPath, destPath);
    }
  }

  // node_modules の存在確認
  const localNodeModules = path.join(localBuildDir, 'node_modules');
  if (!fs.existsSync(localNodeModules)) {
    log('Installing dependencies on local build environment...');
    execSync('npm install', { cwd: localBuildDir, stdio: 'inherit' });
  }

  // 2. Vite Build 実行
  log('Executing Vite build...');
  execSync('npx vite build', { cwd: localBuildDir, stdio: 'inherit' });

  // 3. dist/ ディレクトリ全体（bundle.js, chunks, assets）を元のワークスペースへ書き戻す
  const localDistDir = path.join(localBuildDir, 'dist');
  const targetDistDir = path.join(sourceDir, 'dist');

  if (!fs.existsSync(localDistDir)) {
    throw new Error('dist directory was not generated in local build dir.');
  }

  try {
    if (!fs.existsSync(targetDistDir)) {
      fs.mkdirSync(targetDistDir, { recursive: true });
    }
    // 個別にコピー（rmSyncを避け、上書きコピー）
    copySync(localDistDir, targetDistDir);
    const bundleStat = fs.statSync(path.join(targetDistDir, 'bundle.js'));
    log(`Successfully copied dist/ (including split chunks) to workspace. Router bundle.js: ${(bundleStat.size / 1024).toFixed(1)} KB`);
  } catch (copyErr) {
    console.error('Copy to workspace failed:', copyErr);
    throw copyErr;
  }
}

runBuild().catch(err => {
  console.error('❌ Build failed with error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
