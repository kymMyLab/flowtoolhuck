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

  // 3. dist/bundle.js を元のワークスペースへ書き戻す
  const localBundle = path.join(localBuildDir, 'dist', 'bundle.js');
  const targetDistDir = path.join(sourceDir, 'dist');
  const targetBundle = path.join(targetDistDir, 'bundle.js');

  if (!fs.existsSync(localBundle)) {
    throw new Error('dist/bundle.js was not generated in local build dir.');
  }

  if (!fs.existsSync(targetDistDir)) {
    fs.mkdirSync(targetDistDir, { recursive: true });
  }

  fs.copyFileSync(localBundle, targetBundle);
  const bundleStat = fs.statSync(targetBundle);
  log(`Successfully copied dist/bundle.js to workspace (${(bundleStat.size / 1024).toFixed(1)} KB)`);
}

runBuild().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
