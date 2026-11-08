import { connectHost } from '@openchamber/sdk';
import { applyHostReady, mountButton, mountList, mountTextField } from '@openchamber/sdk/ui';

import { ciAttachment, commentAttachment, mrAttachment } from '../shared/attachments.js';
import {
  decodeArray,
  decodeCheck,
  decodeComment,
  decodeLogin,
  decodeMr,
  decodePage,
} from '../shared/decode.js';
import type { MergeRequest, User } from '../shared/model.js';

import './style.css';

const host = connectHost();
const root = document.getElementById('root');
if (!root) throw new Error('Panel root is missing.');

async function request(path: string, query: Record<string, string> = {}): Promise<unknown> {
  const response = await host.serviceRequest({ method: 'GET', path, query });
  const data: unknown = JSON.parse(response.body);
  if (response.status < 200 || response.status >= 300) {
    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      data.error &&
      typeof data.error === 'object' &&
      'message' in data.error &&
      typeof data.error.message === 'string'
    )
      throw new Error(data.error.message);
    throw new Error('The service request failed.');
  }
  return data;
}

// Commands are registered synchronously, including in the background resolver frame.
host.onResolve(async ({ command, args }) => {
  const [repo, numberText, extra] = args.trim().split(/\s+/);
  const number = Number(numberText);
  if (!repo || !Number.isSafeInteger(number) || number < 1 || extra)
    throw new Error('Use: repository/path MR-number');
  const login = decodeLogin(await request('/auth/status'));
  if (login.state !== 'connected') throw new Error(login.message);
  const mr = decodeMr(await request('/mr', { repo, number: String(number), account: login.user.id }));
  return command === 'codebase-ci' ? ciAttachment(repo, mr) : mrAttachment(repo, mr);
});

let mounted = false;
let account: User | null = null;
let repository = '';
let selected: MergeRequest | null = null;
let selectedRepo = '';
let page = 1;
let generation = 0;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

const statusLine = element('p', 'status');
statusLine.setAttribute('role', 'status');
function report(error: unknown): void {
  statusLine.textContent = error instanceof Error ? error.message : 'The request failed.';
}
function act(job: () => Promise<void>): void {
  void job().catch(report);
}

function mount(): void {
  if (!root) return;
  const note = element('p', 'note');
  note.textContent =
    'Local-service example. Native source-control sign-in needs the proposed host capability.';
  const authRow = element('div', 'actions');
  const accountLabel = element('span');
  const refreshRoot = element('span');
  authRow.append(accountLabel, refreshRoot);
  const controls = element('div', 'controls');
  const fieldRoot = element('div');
  const loadRoot = element('div');
  controls.append(fieldRoot, loadRoot);
  const listRoot = element('div');
  const pagination = element('div', 'actions');
  const previousRoot = element('span');
  const nextRoot = element('span');
  pagination.append(previousRoot, nextRoot);
  const detail = element('section', 'section');
  const checks = element('section', 'section');
  const comments = element('section', 'section');
  root.append(note, authRow, controls, statusLine, listRoot, pagination, detail, checks, comments);
  mountTextField(fieldRoot, {
    label: 'Repository',
    value: repository,
    placeholder: 'example/team-repo',
    onChange: (value) => {
      repository = value;
    },
  });
  const rows = mountList(listRoot, {
    items: [],
    ariaLabel: 'Merge requests',
    emptyText: 'Choose a repository, then load MRs.',
    onSelect: (id) => act(() => select(Number(id))),
  });

  function clear(): void {
    generation += 1;
    selected = null;
    rows.update({ items: [], selectedId: null });
    detail.replaceChildren();
    checks.replaceChildren();
    comments.replaceChildren();
    previous.update({ disabled: true });
    next.update({ disabled: true });
  }
  async function refresh(): Promise<void> {
    clear();
    account = null;
    accountLabel.textContent = 'Checking CLI login';
    const requestGeneration = generation;
    const login = decodeLogin(await request('/auth/status'));
    if (requestGeneration !== generation) return;
    account = login.state === 'connected' ? login.user : null;
    accountLabel.textContent =
      login.state === 'connected' ? `CLI connected: ${login.user.login}` : login.message;
    statusLine.textContent = '';
  }
  mountButton(refreshRoot, {
    label: 'Refresh login',
    variant: 'outline',
    onClick: () => act(refresh),
  });
  const previous = mountButton(previousRoot, {
    label: 'Previous',
    variant: 'outline',
    disabled: true,
    onClick: () => act(() => load(selectedRepo, page - 1)),
  });
  const next = mountButton(nextRoot, {
    label: 'Next',
    variant: 'outline',
    disabled: true,
    onClick: () => act(() => load(selectedRepo, page + 1)),
  });
  mountButton(loadRoot, {
    label: 'Load MRs',
    onClick: () => act(() => load(repository.trim(), 1)),
  });

  function query(repo: string, number?: number): Record<string, string> {
    if (!account) throw new Error('Refresh CLI login before reading MRs.');
    return { repo, account: account.id, ...(number ? { number: String(number) } : {}) };
  }
  async function load(repo: string, targetPage: number): Promise<void> {
    const input = query(repo);
    clear();
    const requestGeneration = generation;
    statusLine.textContent = 'Loading MRs';
    const result = decodePage(await request('/mrs', { ...input, page: String(targetPage) }), decodeMr);
    if (requestGeneration !== generation) return;
    selectedRepo = repo;
    page = result.page;
    rows.update({
      items: result.items.map((mr) => ({
        id: String(mr.number),
        leading: `!${mr.number}`,
        title: mr.title,
        meta: mr.state,
      })),
    });
    previous.update({ disabled: page <= 1 });
    next.update({ disabled: !result.hasMore });
    statusLine.textContent = result.items.length ? `Page ${page}` : 'No merge requests on this page.';
  }
  async function select(number: number): Promise<void> {
    const requestGeneration = ++generation;
    const repo = selectedRepo;
    const mr = decodeMr(await request('/mr', query(repo, number)));
    if (requestGeneration !== generation) return;
    selected = mr;
    rows.update({ selectedId: String(number) });
    detail.replaceChildren();
    checks.replaceChildren();
    comments.replaceChildren();
    const title = element('h2');
    title.textContent = `!${mr.number} ${mr.title}`;
    const branches = element('p', 'metadata');
    branches.textContent = `${mr.head} → ${mr.base}`;
    branches.dir = 'ltr';
    const description = element('pre', 'description');
    description.textContent = mr.description;
    const actions = element('div', 'actions');
    detail.append(title, branches, description, actions);
    for (const [label, attachment] of [
      ['Attach MR', mrAttachment(repo, mr)],
      ['Attach CI instructions', ciAttachment(repo, mr)],
    ] as const) {
      const container = element('span');
      actions.append(container);
      mountButton(container, {
        label,
        variant: 'outline',
        onClick: () =>
          act(async () => {
            await host.attach(attachment);
            statusLine.textContent = 'Added to the composer. Nothing was sent.';
          }),
      });
    }
    const checksRoot = element('span');
    const commentsRoot = element('span');
    actions.append(checksRoot, commentsRoot);
    mountButton(checksRoot, {
      label: 'Load checks',
      variant: 'ghost',
      onClick: () =>
        act(async () => {
          const result = decodePage(await request('/checks', query(repo, number)), decodeCheck);
          if (selected !== mr) return;
          const text = element('pre', 'description');
          text.textContent =
            result.items.map((check) => `${check.name}: ${check.conclusion || check.state}`).join('\n') ||
            'No checks on this page.';
          if (result.hasMore) text.textContent += '\nMore checks are available through the CLI.';
          checks.replaceChildren(text);
        }),
    });
    mountButton(commentsRoot, {
      label: 'Load comments',
      variant: 'ghost',
      onClick: () =>
        act(async () => {
          const result = decodeArray(await request('/comments', query(repo, number)), decodeComment);
          if (selected !== mr) return;
          comments.replaceChildren();
          for (const comment of result) {
            const row = element('article', 'comment-row');
            const meta = element('p', 'metadata');
            meta.textContent = [
              comment.author,
              comment.createdAt,
              comment.location,
              comment.resolved ? 'Resolved' : '',
              comment.outdated ? 'Outdated' : '',
            ]
              .filter(Boolean)
              .join(' · ');
            const body = element('pre', 'comment');
            body.textContent = comment.body;
            const attachRoot = element('span');
            row.append(meta, body, attachRoot);
            comments.append(row);
            mountButton(attachRoot, {
              label: 'Attach comment',
              variant: 'ghost',
              onClick: () =>
                act(async () => {
                  await host.attach(commentAttachment(repo, mr, comment));
                  statusLine.textContent = 'Comment added to the composer.';
                }),
            });
          }
          if (!result.length) comments.textContent = 'No comments.';
        }),
    });
    statusLine.textContent = 'MR loaded.';
  }
  act(refresh);
}

host.onReady((context) => {
  applyHostReady(context, document.documentElement);
  if (!mounted && context.surface !== 'background') {
    mounted = true;
    mount();
  }
});
