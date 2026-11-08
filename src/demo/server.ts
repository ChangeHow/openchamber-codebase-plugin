import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAdapter } from '../service/adapter.js';
import { serviceHandler } from '../service/http.js';
import { fixtureCli } from './fixtures.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const handler = serviceHandler(createAdapter(fixtureCli), 'synthetic-preview-only');
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
};
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    req.url = `${url.pathname.slice(4)}${url.search}`;
    req.headers.authorization = 'Bearer synthetic-preview-only';
    void handler(req, res);
    return;
  }
  const relative = url.pathname === '/' ? 'demo.html' : decodeURIComponent(url.pathname).slice(1);
  const file = resolve(root, relative);
  const contentType = mime[extname(file)];
  if (!file.startsWith(root) || !contentType) {
    res.writeHead(404).end();
    return;
  }
  void readFile(file)
    .then((body) => {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      });
      res.end(body);
    })
    .catch(() => {
      res.writeHead(404).end();
    });
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string')
    console.log(`Synthetic preview: http://localhost:${address.port}`);
});
process.once('SIGTERM', () => {
  server.close();
});
