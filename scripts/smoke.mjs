import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

import { fixtureCli } from '../dist/demo/fixtures.js';
import { createAdapter } from '../dist/service/adapter.js';
import { runCodebase } from '../dist/service/cli.js';
import { serviceHandler } from '../dist/service/http.js';

const directory = await mkdtemp(join(tmpdir(), 'openchamber-codebase-smoke-'));
const previousPath = process.env.PATH;
const previousToken = process.env.OPENCHAMBER_SERVICE_TOKEN;
let cliCalls = 0;
const handler = serviceHandler(
  createAdapter(async (args) => {
    cliCalls += 1;
    return fixtureCli(args);
  }),
  'synthetic-service-secret',
);
const server = createServer((req, res) => {
  void handler(req, res);
});

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/auth/status`)).status, 401);
  assert.equal(cliCalls, 0);
  const headers = { Authorization: 'Bearer synthetic-service-secret' };
  const login = await (await fetch(`${base}/auth/status`, { headers })).json();
  assert.equal(login.state, 'connected');
  const page = await (await fetch(`${base}/mrs?repo=example/team-repo&account=1001`, { headers })).json();
  assert.equal(page.items[0].number, 42);

  const binary = join(directory, 'codebase');
  process.env.PATH = `${directory}${delimiter}${dirname(process.execPath)}`;
  process.env.OPENCHAMBER_SERVICE_TOKEN = 'synthetic-secret-do-not-forward';
  await writeFile(
    binary,
    '#!/usr/bin/env node\nconsole.log(JSON.stringify({args:process.argv.slice(2),hasHostSecret:Boolean(process.env.OPENCHAMBER_SERVICE_TOKEN)}));\n',
    { mode: 0o755 },
  );
  assert.deepEqual(await runCodebase(['mr', 'list', '-R', 'example/team-repo']), {
    args: ['mr', 'list', '-R', 'example/team-repo'],
    hasHostSecret: false,
  });
  await writeFile(
    binary,
    '#!/usr/bin/env node\nconsole.error("synthetic-private-error");process.exit(1);\n',
    { mode: 0o755 },
  );
  await assert.rejects(
    runCodebase(['auth', 'status']),
    (error) => error.code === 'CLI_FAILED' && !error.message.includes('synthetic-private-error'),
  );
  console.log('Synthetic HTTP and subprocess smoke passed. No real CLI or forge was contacted.');
} finally {
  // Release only this smoke's resources. Cleanup failures must not hide the original assertion failure.
  if (previousPath === undefined) delete process.env.PATH;
  else process.env.PATH = previousPath;
  if (previousToken === undefined) delete process.env.OPENCHAMBER_SERVICE_TOKEN;
  else process.env.OPENCHAMBER_SERVICE_TOKEN = previousToken;
  await new Promise((resolve) => {
    server.close(resolve);
  });
  await rm(directory, { recursive: true, force: true }).catch(() => {
    console.error('Smoke temporary directory cleanup failed.');
    process.exitCode = 1;
  });
}
