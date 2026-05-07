/**
 * Debug: directly test niuke and neituiya crawl logic
 */
import axios from 'axios';
import { load } from 'cheerio';

// ============ NIUKE ============
async function testNiuke() {
  console.log('=== Testing Niuke ===\n');

  const url = 'https://www.nowcoder.com/jobs/school/jobs';
  const HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  try {
    const response = await axios.get(url, { headers: HTTP_HEADERS, timeout: 30000 });
    const html = response.data;
    console.log(`HTML length: ${html.length}`);
    console.log(`Status: ${response.status}`);

    const marker = 'window.__INITIAL_STATE__=';
    const markerIndex = html.indexOf(marker);
    console.log(`__INITIAL_STATE__ marker found at: ${markerIndex}`);

    if (markerIndex < 0) {
      console.log('ERROR: __INITIAL_STATE__ not found in page');
      // Check for common error pages
      if (html.includes('验证') || html.includes('验证码') || html.includes('captcha')) {
        console.log('Possible captcha page');
      }
      if (html.includes('403') || html.includes('Forbidden')) {
        console.log('Possible 403 Forbidden');
      }
      return;
    }

    // Try to extract JSON
    let index = markerIndex + marker.length;
    while (index < html.length && html[index] !== '{') index++;

    if (html[index] !== '{') {
      console.log('ERROR: JSON start not found');
      return;
    }

    // Balance brackets
    let depth = 0, inString = false, escaped = false;
    let endIndex = index;
    for (let i = index; i < html.length; i++) {
      const char = html[i];
      if (escaped) { escaped = false; continue; }
      if (char === '\\' && inString) { escaped = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{') depth++;
      if (char === '}') { depth--; if (depth === 0) { endIndex = i + 1; break; } }
    }

    const jsonStr = html.slice(index, endIndex);
    console.log(`JSON length: ${jsonStr.length}`);
    const state = JSON.parse(jsonStr);
    console.log(`Parsed successfully. Keys: ${Object.keys(state).join(', ')}`);

    // Try to find job cards
    const jobs = findJobCards(state);
    console.log(`Found ${jobs.length} job cards`);
    if (jobs.length > 0) {
      const first = jobs[0];
      console.log('First job:', JSON.stringify(first, null, 2));
    }
  } catch (err: unknown) {
    console.error('Niuke error:', err instanceof Error ? err.message : err);
  }
}

function findJobCards(obj: unknown, depth = 0): unknown[] {
  if (depth > 20) return [];
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) return obj.flatMap(item => findJobCards(item, depth + 1));

  const record = obj as Record<string, unknown>;
  if (record.id && record.jobName && typeof record.id === 'number' && typeof record.jobName === 'string') {
    return [record];
  }

  return Object.values(record).flatMap(v => findJobCards(v, depth + 1));
}

// ============ NEITUIYA ============
async function testNeituiya() {
  console.log('\n=== Testing Neituiya ===\n');

  const API_BASE = 'https://www.neituiya.com/bapeApi';
  const HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://www.neituiya.com',
    Referer: 'https://www.neituiya.com/software',
  };

  // Test recruit moments
  try {
    console.log('Testing /paper/ugc/recruit/moment...');
    const resp = await axios.post(`${API_BASE}/paper/ugc/recruit/moment`,
      { page: 1, perPage: 15 },
      { headers: { ...HTTP_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
    );
    const payload = resp.data;
    console.log(`Response code: ${payload.code}, msg: ${payload.msg}`);
    if (payload.data) {
      const items = payload.data.items ?? payload.data.result ?? [];
      console.log(`Found ${items.length} listings`);
      if (items.length > 0) {
        console.log('First item:', JSON.stringify(items[0], null, 2));
      }
    }

    // Test detail API for first item
    if (payload.data?.items?.[0]) {
      const firstId = payload.data.items[0].id;
      console.log(`\nTesting /paper/detail/${firstId}...`);
      const detailResp = await axios.get(`${API_BASE}/paper/detail/${firstId}`, {
        headers: HTTP_HEADERS,
        timeout: 20000
      });
      const detailPayload = detailResp.data;
      console.log(`Detail code: ${detailPayload.code}, msg: ${detailPayload.msg}`);
      if (detailPayload.data) {
        console.log('Detail data keys:', Object.keys(detailPayload.data));
        console.log('Paper model:', JSON.stringify(detailPayload.data.paperModelView, null, 2));
      }
    }
  } catch (err: unknown) {
    console.error('Neituiya error:', err instanceof Error ? err.message : String(err));
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      console.log('HTTP status:', axiosErr.response?.status);
      console.log('Response data:', JSON.stringify(axiosErr.response?.data, null, 2));
    }
  }
}

async function main() {
  await testNiuke();
  await testNeituiya();
}

main().catch(console.error);
