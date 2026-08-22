import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

try {
  const config = loadConfig();
  const app = createApp(config);

  serve({ fetch: app.fetch, port: config.port }, info => {
    console.log(`CPMM-SHIELD running on http://localhost:${info.port}`);
    console.log('Health endpoint: /health');
    console.log('Protected endpoint: POST /api/shield/execute');
    console.log(`Treasury: ${config.treasuryMnemonic ? 'configured' : 'not configured'}`);
    console.log(`Payment network: Algorand ${config.networkName}`);
  });
} catch (error) {
  console.error(`CPMM-SHIELD could not start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
