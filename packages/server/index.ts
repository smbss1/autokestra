// Server package entry point
export const version = '0.0.1';

// Basic HTTP server using Hono
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', version: '0.0.1', timestamp: new Date().toISOString() });
});

// Status endpoint
app.get('/api/v1/status', (c) => {
  return c.json({
    status: 'operational',
    version: '0.0.1',
    features: {
      workflows: false, // Not implemented yet
      executions: false, // Not implemented yet
      plugins: false // Not implemented yet
    }
  });
});

// Placeholder for workflows endpoints
app.get('/api/v1/workflows', (c) => {
  return c.json({ workflows: [], total: 0 });
});

app.post('/api/v1/workflows', (c) => {
  return c.json({ error: 'Not implemented' }, 501);
});

// Placeholder for executions endpoints
app.get('/api/v1/executions', (c) => {
  return c.json({ executions: [], total: 0 });
});

// Start server function
export function startServer(port: number = 3000) {
  console.log(`Starting Autokestra server on port ${port}...`);

  // Start the server using Bun
  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.log(`Server running at http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API status: http://localhost:${port}/api/v1/status`);

  return server;
}

export { app };
