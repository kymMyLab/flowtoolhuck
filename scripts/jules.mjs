#!/usr/bin/env node
/**
 * Jules API Automation Dispatcher
 *
 * Automatically dispatches tasks to Google Labs Jules with full autonomy:
 * - requirePlanApproval: false (Proceeds immediately without waiting for human confirmation)
 * - automationMode: "AUTO_CREATE_PR" (Automatically creates Pull Request on completion)
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const API_KEY = process.env.JULES_API_KEY;
if (!API_KEY) {
  console.error('❌ Error: JULES_API_KEY is not set.');
  console.error('Please set JULES_API_KEY in your .env file or environment variables.');
  process.exit(1);
}

const DEFAULT_REPO = 'sources/github/kymMyLab/flowtoolhuck';
const DEFAULT_BRANCH = 'main';

function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'jules.googleapis.com',
      headers: {
        'x-goog-api-key': API_KEY,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      },
      ...options
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function createSession(promptText, title) {
  console.log('🚀 Dispatching task to Jules with FULL AUTONOMY...');
  console.log(`📌 Title: ${title}`);
  console.log(`📌 Repository: ${DEFAULT_REPO} (${DEFAULT_BRANCH})`);
  console.log('⚙️ Options: requirePlanApproval=false, automationMode=AUTO_CREATE_PR\n');

  const payload = JSON.stringify({
    prompt: promptText,
    title: title || `Autonomous Task - ${new Date().toISOString().slice(0, 10)}`,
    sourceContext: {
      source: DEFAULT_REPO,
      githubRepoContext: {
        startingBranch: DEFAULT_BRANCH
      }
    },
    automationMode: 'AUTO_CREATE_PR',
    requirePlanApproval: false
  });

  const res = await apiRequest({
    path: '/v1alpha/sessions',
    method: 'POST'
  }, payload);

  if (res.status === 200) {
    console.log('✅ Session created successfully!');
    console.log(`🔗 Web URL: ${res.data.url || `https://jules.google.com/session/${res.data.id}`}`);
    console.log(`🆔 Session ID: ${res.data.id || res.data.name}`);
    console.log(`📊 State: ${res.data.state || 'QUEUED'}`);
    return res.data;
  } else {
    console.error('❌ Failed to create session:', res.status, res.data || res.raw);
    process.exit(1);
  }
}

async function getSessionStatus(sessionId) {
  const cleanId = sessionId.replace(/^sessions\//, '');
  const res = await apiRequest({
    path: `/v1alpha/sessions/${cleanId}`,
    method: 'GET'
  });
  if (res.status === 200) {
    console.log(`\n📋 Session Details: ${cleanId}`);
    console.log(`Title: ${res.data.title}`);
    console.log(`State: ${res.data.state}`);
    console.log(`URL: ${res.data.url}`);
    console.log(`Created: ${res.data.createTime}`);
    console.log(`Updated: ${res.data.updateTime}`);
    return res.data;
  } else {
    console.error('❌ Failed to fetch session:', res.status, res.data || res.raw);
  }
}

async function listSessions() {
  const res = await apiRequest({
    path: '/v1alpha/sessions',
    method: 'GET'
  });
  if (res.status === 200 && res.data.sessions) {
    console.log('\n📜 Recent Jules Sessions:');
    for (const s of res.data.sessions.slice(0, 10)) {
      console.log(`- [${s.state}] ${s.title || 'Untitled'} (${s.id || s.name}) -> ${s.url}`);
    }
  } else {
    console.log('No sessions found or response:', res.data || res.raw);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    await listSessions();
    return;
  }

  const statusIdx = args.indexOf('--status');
  if (statusIdx !== -1 && args[statusIdx + 1]) {
    await getSessionStatus(args[statusIdx + 1]);
    return;
  }

  // Determine prompt
  let promptText = '';
  let title = '';

  const nonFlagArgs = args.filter(a => !a.startsWith('--'));
  if (nonFlagArgs.length === 0) {
    // Default to JULES_TASK.md
    const defaultTaskFile = path.join(rootDir, 'JULES_TASK.md');
    if (fs.existsSync(defaultTaskFile)) {
      console.log(`📖 Loading task instructions from: JULES_TASK.md`);
      promptText = fs.readFileSync(defaultTaskFile, 'utf8');
      title = `Jules Mission (${new Date().toLocaleDateString('ja-JP')})`;
    } else {
      console.error('❌ No prompt provided and JULES_TASK.md not found.');
      process.exit(1);
    }
  } else {
    const input = nonFlagArgs.join(' ');
    if (fs.existsSync(input)) {
      console.log(`📖 Loading task from file: ${input}`);
      promptText = fs.readFileSync(input, 'utf8');
      title = `Task from ${path.basename(input)}`;
    } else {
      promptText = input;
      title = input.slice(0, 40) + '...';
    }
  }

  await createSession(promptText, title);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
