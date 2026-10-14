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
  const localDistDir = path.join(localBuildDir, 'dist');
  if (fs.existsSync(localDistDir)) {
    fs.rmSync(localDistDir, { recursive: true, force: true });
  }
  log('Executing Vite build...');
  execSync('npx vite build', { cwd: localBuildDir, stdio: 'inherit' });

  // 3. dist/ ディレクトリ全体（bundle.js）を元のワークスペースへ書き戻す
  const targetDistDir = path.join(sourceDir, 'dist');

  if (!fs.existsSync(localDistDir)) {
    throw new Error('dist directory was not generated in local build dir.');
  }

  log('Copying built artifacts back to workspace...');
  try {
    if (!fs.existsSync(targetDistDir)) {
      fs.mkdirSync(targetDistDir, { recursive: true });
    }
    const targetChunksDir = path.join(targetDistDir, 'chunks');
    if (fs.existsSync(targetChunksDir)) {
      try {
        fs.rmSync(targetChunksDir, { recursive: true, force: true });
        log('Removed old chunks directory.');
      } catch (e) {
        console.warn('Could not remove chunks dir:', e && e.message ? e.message : e);
      }
    }
    // 単一バンドル等のファイルを直接コピー
    const distFiles = fs.readdirSync(localDistDir);
    for (const file of distFiles) {
      const srcFile = path.join(localDistDir, file);
      const destFile = path.join(targetDistDir, file);
      const stat = fs.statSync(srcFile);
      if (stat.isFile()) {
        fs.copyFileSync(srcFile, destFile);
        log(`Copied ${file} (${(stat.size / 1024).toFixed(1)} KB)`);
      }
    }
    const bundleStat = fs.statSync(path.join(targetDistDir, 'bundle.js'));
    log(`Successfully finalized dist/bundle.js: ${(bundleStat.size / 1024).toFixed(1)} KB`);
  } catch (copyErr) {
    console.error('❌ Copy to workspace failed:', copyErr);
    throw copyErr;
  }
}

runBuild().then(() => {
  log('Build script finished successfully.');
  process.exit(0);
}).catch(err => {
  console.error('❌ Build failed with error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
