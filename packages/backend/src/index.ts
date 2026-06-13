import express from 'express';
import { config } from './config';
import { buildAppRegistry } from './app/app-registry';
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

// Routes
app.use('/api/apps',   appsRouter(registry));
app.use('/api/schema', schemaRouter(registry));
app.use('/api/items',  itemsRouter(registry));

// Placeholder acknowledged by Step 4 (LiveChannel) and Step 5 (agent)
app.get('/api/health', (_req, res) => res.json({ ok: true, domains: domainIds }));

const server = app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

// LiveChannel will attach to this server in Step 4
export { server };
