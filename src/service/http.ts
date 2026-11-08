import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Adapter } from './adapter.js';
import { positive } from './adapter.js';
import { CliError } from './cli.js';

export function serviceHandler(adapter: Adapter, token: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== `Bearer ${token}`)
      return json(401, {
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized service request.' },
      });
    if (req.method !== 'GET')
      return json(405, {
        error: { code: 'READ_ONLY', message: 'This example supports read-only requests.' },
      });
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/health') return json(200, { ok: true });
      if (url.pathname === '/auth/status') return json(200, await adapter.status());
      const repo = url.searchParams.get('repo') ?? '';
      const account = url.searchParams.get('account') ?? '';
      switch (url.pathname) {
        case '/mrs':
          return json(200, await adapter.list(repo, account, positive(url.searchParams.get('page'), 1)));
        case '/mr':
          return json(200, await adapter.detail(repo, account, positive(url.searchParams.get('number'))));
        case '/comments':
          return json(200, await adapter.comments(repo, account, positive(url.searchParams.get('number'))));
        case '/checks':
          return json(
            200,
            await adapter.checks(
              repo,
              account,
              positive(url.searchParams.get('number')),
              positive(url.searchParams.get('page'), 1),
            ),
          );
        default:
          return json(404, { error: { code: 'NOT_FOUND', message: 'Unknown example endpoint.' } });
      }
    } catch (error) {
      if (error instanceof CliError)
        return json(error.status, { error: { code: error.code, message: error.message } });
      return json(500, {
        error: {
          code: 'SERVICE_ERROR',
          message: 'The example service could not complete the request.',
        },
      });
    }
  };
}
