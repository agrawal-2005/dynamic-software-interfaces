import express from 'express';
import { createServer } from 'http';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import { buildAppRegistry } from './app/app-registry';
import { LiveChannel } from './engine/live-channel';
import { SidebarGenerator } from './engine/sidebar-generator';
import { appsRouter } from './routes/apps';
import { schemaRouter } from './routes/schema';
import { itemsRouter } from './routes/items';
import { agentRouter } from './routes/agent';
import { sidebarAgentRouter } from './routes/sidebar-agent';

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
const registry = buildAppRegistry(config.geminiApiKey);
const domainIds = Object.keys(registry);
console.log(`Registered domains: ${domainIds.join(', ')}`);

// Sidebar generator — one instance, not per-domain.
// Vocabulary is derived from the registry so it stays in sync automatically.
const sidebarVocab = {
  items: Object.values(registry).map((b) => ({ key: b.id, label: b.label })),
};
const geminiClient  = new GoogleGenerativeAI(config.geminiApiKey);
const sidebarGen    = new SidebarGenerator(geminiClient, sidebarVocab);
console.log(`Sidebar vocabulary: ${sidebarVocab.items.map((i) => i.key).join(', ')}`);

// LiveChannel: one instance manages all domains' WebSocket rooms.
const liveChannel = new LiveChannel();
for (const bundle of Object.values(registry)) {
  liveChannel.attachStore(bundle.id, bundle.store);
}

// Routes
app.use('/api/apps',                  appsRouter(registry));
app.use('/api/schema',               schemaRouter(registry));
app.use('/api/items',                itemsRouter(registry));
app.use('/api/generate-spec',        agentRouter(registry));
app.use('/api/generate-sidebar-spec', sidebarAgentRouter(sidebarGen));

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
