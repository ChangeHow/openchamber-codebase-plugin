import type { RunCli } from '../service/cli.js';

// Entirely invented data. No production command output is stored in this project.
export const fixtureMr = {
  Id: '42',
  Number: 42,
  Title: 'Handle an empty search result',
  Status: 'open',
  URL: 'https://forge.example.test/example/team-repo/merge_requests/42',
  CreatedBy: { Username: 'demo-user' },
  Description: 'Keep the empty state visible when a search returns no results.',
  SourceBranchName: 'fix/empty-search',
  TargetBranchName: 'main',
  SourceBranch: { Name: 'fix/empty-search', Commit: { Id: 'a'.repeat(40) } },
  TargetBranch: { Name: 'main', Commit: { Id: 'b'.repeat(40) } },
};

export const fixtureCli: RunCli = async (args) => {
  if (args[0] === 'auth') return { Authenticated: true, Valid: true };
  if (args[0] === 'user') return { Id: '1001', Username: 'demo-user' };
  const page = Number(args[args.indexOf('--page') + 1] ?? '1');
  if (args[1] === 'list') return { MergeRequests: page === 1 ? [fixtureMr] : [], TotalCount: 1 };
  if (args[1] === 'view') return fixtureMr;
  if (args[1] === 'comment')
    return {
      Threads: [
        {
          Id: 'thread-1',
          Status: 'open',
          Outdated: false,
          Positions: [{ Path: 'src/search.ts', StartLine: 12 }],
          Comments: [
            {
              Id: 'comment-1',
              CreatedBy: 'demo-reviewer',
              CreatedAt: '2026-01-01T12:00:00Z',
              Content: 'Please add an empty-result case before merging.',
            },
          ],
        },
      ],
    };
  if (args[1] === 'checks')
    return {
      TotalCount: 1,
      CheckRuns:
        page === 1
          ? [
              {
                Id: 'check-1',
                Name: 'Type check',
                Status: 'completed',
                Conclusion: 'failed',
                CommitId: 'a'.repeat(40),
              },
            ]
          : [],
    };
  throw new Error('Unexpected fixture command.');
};
