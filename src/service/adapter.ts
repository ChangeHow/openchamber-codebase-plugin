import type { Check, Comment, LoginStatus, MergeRequest, Page, User } from '../shared/model.js';
import { checked, CliError, list, object, text, type RunCli } from './cli.js';

function repository(value: string): string {
  if (
    !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(value) ||
    value.split('/').some((part) => part === '.' || part === '..' || part.startsWith('-'))
  ) {
    throw new CliError('BAD_INPUT', 'Use a repository path such as example/team-repo.', 400);
  }
  return value;
}

export function positive(value: string | null, fallback?: number): number {
  if (value === null && fallback !== undefined) return fallback;
  const result = Number(value);
  if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(result) || result < 1) {
    throw new CliError('BAD_INPUT', 'A positive MR or page number is required.', 400);
  }
  return result;
}

const PAGE_SIZE = 20;

function toPage<T>(items: T[], result: Record<string, unknown>, page: number): Page<T> {
  const total = Number(result.TotalCount);
  return {
    items,
    page,
    hasMore: Number.isFinite(total) ? page * PAGE_SIZE < total : items.length === PAGE_SIZE,
  };
}

function accountChanged(): CliError {
  return new CliError('ACCOUNT_CHANGED', 'The CLI account changed. Refresh the login status.', 409);
}

function user(value: unknown): User {
  const raw = checked(value);
  const id = text(raw.Id);
  const login = text(raw.Username);
  if (!id || !login) throw new CliError('INVALID_IDENTITY', 'The CLI did not identify the current user.');
  return { id, login };
}

function username(value: unknown): string {
  if (typeof value === 'string') return value;
  return value && typeof value === 'object' ? text(object(value).Username) : '';
}

function branch(value: unknown, fallback: unknown): { name: string; sha: string } {
  if (!value || typeof value !== 'object') return { name: text(fallback), sha: '' };
  const raw = object(value);
  return {
    name: text(raw.Name) || text(fallback),
    sha: raw.Commit ? text(object(raw.Commit).Id) : '',
  };
}

function mergeRequest(value: unknown, number?: number): MergeRequest {
  const raw = object(value);
  const head = branch(raw.SourceBranch, raw.SourceBranchName);
  const base = branch(raw.TargetBranch, raw.TargetBranchName);
  const mrNumber = Number(raw.Number ?? number);
  const title = text(raw.Title);
  if (!Number.isSafeInteger(mrNumber) || mrNumber < 1 || !title) {
    throw new CliError('INVALID_RESPONSE', 'The CLI returned an incomplete merge request.');
  }
  return {
    number: mrNumber,
    title,
    state: text(raw.Status),
    url: text(raw.URL),
    head: head.name,
    base: base.name,
    headSha: head.sha,
    author: username(raw.CreatedBy),
    description: text(raw.Description),
  };
}

export function createAdapter(run: RunCli) {
  async function identity(): Promise<User> {
    return user(await run(['user', 'view']));
  }

  async function status(): Promise<LoginStatus> {
    const raw = object(await run(['auth', 'status']));
    if (typeof raw.Authenticated !== 'boolean')
      throw new CliError('INVALID_RESPONSE', 'The CLI returned an invalid login status.');
    if (raw.Authenticated !== true || raw.Valid !== true) {
      return {
        state: 'disconnected',
        message: 'Run codebase auth login on the OpenChamber server.',
      };
    }
    return { state: 'connected', user: await identity() };
  }

  async function read(accountId: string, args: string[]): Promise<Record<string, unknown>> {
    if (!accountId || (await identity()).id !== accountId) throw accountChanged();
    const result = checked(await run(args));
    // A user can switch the CLI account while the request is in flight.
    if ((await identity()).id !== accountId) throw accountChanged();
    return result;
  }

  return {
    status,
    async list(repo: string, accountId: string, page: number): Promise<Page<MergeRequest>> {
      const result = await read(accountId, [
        'mr',
        'list',
        '-R',
        repository(repo),
        '--page',
        String(page),
        '--page-size',
        String(PAGE_SIZE),
      ]);
      return toPage(
        list(result.MergeRequests).map((item) => mergeRequest(item)),
        result,
        page,
      );
    },
    async detail(repo: string, accountId: string, number: number): Promise<MergeRequest> {
      return mergeRequest(
        await read(accountId, ['mr', 'view', '-R', repository(repo), '-N', String(number), '--verbose']),
        number,
      );
    },
    async comments(repo: string, accountId: string, number: number): Promise<Comment[]> {
      const result = await read(accountId, [
        'mr',
        'comment',
        'list',
        '-R',
        repository(repo),
        '-N',
        String(number),
      ]);
      return list(result.Threads)
        .flatMap((entry) => {
          const thread = object(entry);
          const positions = thread.Positions ? list(thread.Positions) : [];
          const position = positions.at(-1);
          const where = position ? object(position) : null;
          const published = thread.Comments === undefined ? [] : list(thread.Comments);
          return published.map((entry) => {
            const comment = object(entry);
            return {
              id: text(comment.Id),
              threadId: text(thread.Id),
              author: username(comment.CreatedBy),
              body: text(comment.Content),
              createdAt: text(comment.CreatedAt),
              resolved: thread.Status === 'resolved',
              outdated: thread.Outdated === true,
              location: where ? [text(where.Path), text(where.StartLine)].filter(Boolean).join(':') : '',
            };
          });
        })
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    },
    async checks(repo: string, accountId: string, number: number, page: number): Promise<Page<Check>> {
      const result = await read(accountId, [
        'mr',
        'checks',
        'list',
        '-R',
        repository(repo),
        '-N',
        String(number),
        '--page',
        String(page),
        '--page-size',
        String(PAGE_SIZE),
      ]);
      return toPage(
        list(result.CheckRuns).map((entry) => {
          const raw = object(entry);
          return {
            id: text(raw.Id),
            name: text(raw.Name),
            state: text(raw.Status),
            conclusion: text(raw.Conclusion),
            commit: text(raw.CommitId),
          };
        }),
        result,
        page,
      );
    },
  };
}

export type Adapter = ReturnType<typeof createAdapter>;
