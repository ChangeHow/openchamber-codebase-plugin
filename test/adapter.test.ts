import { describe, expect, test } from '@rstest/core';

import { fixtureCli } from '../src/demo/fixtures.js';
import { createAdapter } from '../src/service/adapter.js';
import { ciAttachment, mrAttachment } from '../src/shared/attachments.js';

describe('CLI-backed merge request reads', () => {
  test('a signed-in user can inspect an MR and attach focused MR or CI context', async () => {
    const adapter = createAdapter(fixtureCli);
    const status = await adapter.status();
    expect(status.state).toBe('connected');
    if (status.state !== 'connected') throw new Error('Expected a synthetic signed-in user.');
    const repo = 'example/team-repo';
    const page = await adapter.list(repo, status.user.id, 1);
    expect(page.items.map((mr) => mr.number)).toEqual([42]);
    expect(page.hasMore).toBe(false);
    const mr = await adapter.detail(repo, status.user.id, 42);
    expect(mr.head).toBe('fix/empty-search');
    expect((await adapter.comments(repo, status.user.id, 42))[0]?.threadId).toBe('thread-1');
    expect((await adapter.checks(repo, status.user.id, 42, 1)).items[0]?.conclusion).toBe('failed');
    expect(mrAttachment(repo, mr).text).not.toContain(mr.description);
    expect(ciAttachment(repo, mr).text).toContain(`--commit-id ${'a'.repeat(40)}`);
  });

  test('expired login is disconnected and a failed query does not become an empty list', async () => {
    const adapter = createAdapter(async (args) => {
      if (args[0] === 'auth')
        return { Authenticated: true, Valid: false, Error: { Message: 'private diagnostic' } };
      if (args[1] === 'list') return { Code: 'Denied', Message: 'private diagnostic' };
      return fixtureCli(args);
    });
    expect((await adapter.status()).state).toBe('disconnected');
    await expect(adapter.list('example/team-repo', '1001', 1)).rejects.toThrow(
      'The CLI query failed. Check CLI access on the server.',
    );
  });

  test('a CLI account switch discards the in-flight MR result', async () => {
    let identityReads = 0;
    const adapter = createAdapter(async (args) => {
      if (args[0] === 'user') return { Id: ++identityReads === 1 ? '1001' : '1002', Username: 'demo-user' };
      return fixtureCli(args);
    });
    await expect(adapter.list('example/team-repo', '1001', 1)).rejects.toThrow(
      'The CLI account changed. Refresh the login status.',
    );
  });

  test('published comments survive draft-only threads and sort by instant across offsets', async () => {
    const adapter = createAdapter(async (args) => {
      if (args[1] !== 'comment') return fixtureCli(args);
      return {
        Threads: [
          { Id: 'draft', DraftComments: [{ Content: 'Unpublished draft' }] },
          {
            Id: 'published',
            Comments: [
              { Id: 'later', Content: 'Later', CreatedAt: '2026-01-01T12:00:00Z' },
              { Id: 'earlier', Content: 'Earlier', CreatedAt: '2026-01-01T13:00:00+02:00' },
            ],
          },
        ],
      };
    });
    expect((await adapter.comments('example/team-repo', '1001', 42)).map((comment) => comment.id)).toEqual([
      'earlier',
      'later',
    ]);
  });
});
