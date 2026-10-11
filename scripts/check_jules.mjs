import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const env = fs.readFileSync(path.join(rootDir, '.env'), 'utf8');
const apiKey = env.match(/JULES_API_KEY=(.+)/)[1].trim();

function getActivities(sessionId) {
  return new Promise((resolve) => {
    const cleanId = sessionId.replace(/^sessions\//, '');
    const req = https.request({
      hostname: 'jules.googleapis.com',
      path: `/v1alpha/sessions/${cleanId}/activities`,
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ id: cleanId, status: res.statusCode, json: JSON.parse(data) });
        } catch(e) {
          resolve({ id: cleanId, status: res.statusCode, raw: data });
        }
      });
    });
    req.end();
  });
}

async function main() {
  const sessionIds = [
    '14981992197963617942', // Session 1: Memory
    '17377498767150774939', // Session 2: Resilience
    '6680963512794014167',  // Session 3: Export
    '14190239195294836894', // Session 4: Auto Download
    '11845770547512526665', // New 1
    '11298426220535084058'  // New 2
  ];

  for (const sid of sessionIds) {
    const res = await getActivities(sid);
    console.log(`\n========================================`);
    console.log(`🔍 Session: ${res.id}`);
    if (res.json && res.json.activities) {
      for (const act of res.json.activities) {
        const type = act.type || 'UNKNOWN';
        const msg = act.message || act.description || '';
        const prUrl = act.gitPatch?.pullRequestUrl || act.createPullRequestActivity?.pullRequestUrl || '';
        console.log(`  - [${act.createTime || ''}] ${type}: ${msg} ${prUrl}`);
        if (act.planGeneratedActivity) {
          console.log(`    Plan: ${act.planGeneratedActivity.plan?.title || JSON.stringify(act.planGeneratedActivity).slice(0, 150)}`);
        }
        if (act.userFeedbackRequiredActivity) {
          console.log(`    Feedback Request: ${JSON.stringify(act.userFeedbackRequiredActivity).slice(0, 200)}`);
        }
      }
    } else {
      console.log(`  No activities or error:`, res.json || res.raw);
    }
  }
}

main();
