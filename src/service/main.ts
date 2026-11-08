import { createServer } from 'node:http';

import { createAdapter } from './adapter.js';
import { runCodebase } from './cli.js';
import { serviceHandler } from './http.js';

const port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
const token = process.env.OPENCHAMBER_SERVICE_TOKEN;
if (!Number.isInteger(port) || port < 1 || !token) {
  throw new Error('Start this service through OpenChamber. Host service settings are missing.');
}
const handler = serviceHandler(createAdapter(runCodebase), token);
const server = createServer((req, res) => {
  void handler(req, res);
});
server.listen(port, '127.0.0.1');
process.once('SIGTERM', () => {
  server.close();
});
