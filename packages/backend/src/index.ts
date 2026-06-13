import express from 'express';
import { createServer } from 'http';
import { config } from './config';
import { buildAppRegistry } from './app/app-registry';
import { LiveChannel } from './engine/live-channel';
import { appsRouter } from './routes/apps';
import { schemaRouter } from './routes/schema';
import { itemsRouter } from './routes/items';

const app = express();
app.use(express.json());

// CORS for the Vite dev server
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// Build all domain bundles at startup.
// Each domain gets its own DataStore; the engine classes are defined once.
const registry = buildAppRegistry();
const domainIds = Object.keys(registry);
console.log(`Registered domains: ${domainIds.join(', ')}`);

// LiveChannel: one instance manages all domains' WebSocket rooms.
const liveChannel = new LiveChannel();
for (const bundle of Object.values(registry)) {
  liveChannel.attachStore(bundle.id, bundle.store);
}

// Routes
app.use('/api/apps',   appsRouter(registry));
app.use('/api/schema', schemaRouter(registry));
app.use('/api/items',  itemsRouter(registry));

app.get('/api/health', (_req, res) => {
  const connections = Object.fromEntries(
    domainIds.map((id) => [id, liveChannel.connectionCount(id)]),
  );
  res.json({ ok: true, domains: domainIds, connections });
});

// Wrap Express in a plain http.Server so LiveChannel can share the port.
const server = createServer(app);
liveChannel.attach(server);

server.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
  console.log(`WebSocket live channel ready at ws://localhost:${config.port}/live?app=<id>`);
});
