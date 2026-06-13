/**
 * Quick smoke test for the LiveChannel. Run with:
 *   pnpm --filter @dsi/backend exec tsx src/scripts/test-ws.ts
 *
 * Connects to the engineering domain WS, triggers a mutation,
 * and confirms the 'items:changed' event arrives.
 */
import WebSocket from 'ws';
import http from 'http';

const WS_URL = 'ws://localhost:4000/live?app=engineering';
const MUTATE_URL = 'http://localhost:4000/api/items/dev/mutate?app=engineering';

const ws = new WebSocket(WS_URL);
const received: string[] = [];

ws.on('open', () => {
  console.log('WS connected to', WS_URL);

  // Wait briefly then trigger a mutation
  setTimeout(() => {
    const body = JSON.stringify({ id: 'ENG-001', patch: { status: 'in-progress' } });
    const req = http.request(MUTATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    });
    req.write(body);
    req.end();
    console.log('Mutation sent → ENG-001 status: in-progress');
  }, 400);

  // Collect events then report
  setTimeout(() => {
    console.log(`\nEvents received: ${received.length}`);
    received.forEach((e) => {
      const parsed = JSON.parse(e);
      const detail = parsed.type === 'items:changed'
        ? `| ${parsed.items.length} items in payload`
        : '';
      console.log(' ', parsed.type, detail);
    });
    ws.close();
    process.exit(0);
  }, 1200);
});

ws.on('message', (data) => received.push(data.toString()));
ws.on('error', (err) => { console.error('WS error:', err.message); process.exit(1); });
