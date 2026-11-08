import type { Check, Comment, LoginStatus, MergeRequest, Page } from './model.js';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid service response.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid service response.');
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid service response.');
  return value;
}
export function decodeLogin(value: unknown): LoginStatus {
  const raw = record(value);
  if (raw.state === 'disconnected') return { state: 'disconnected', message: string(raw.message) };
  if (raw.state !== 'connected') throw new Error('Invalid login response.');
  const user = record(raw.user);
  return { state: 'connected', user: { id: string(user.id), login: string(user.login) } };
}
export function decodeMr(value: unknown): MergeRequest {
  const raw = record(value);
  if (typeof raw.number !== 'number' || !Number.isSafeInteger(raw.number) || raw.number < 1)
    throw new Error('Invalid MR response.');
  return {
    number: raw.number,
    title: string(raw.title),
    state: string(raw.state),
    url: string(raw.url),
    head: string(raw.head),
    base: string(raw.base),
    headSha: string(raw.headSha),
    author: string(raw.author),
    description: string(raw.description),
  };
}
export function decodeArray<T>(value: unknown, decode: (entry: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('Invalid list response.');
  return value.map(decode);
}
export function decodePage<T>(value: unknown, decode: (entry: unknown) => T): Page<T> {
  const raw = record(value);
  if (typeof raw.page !== 'number') throw new Error('Invalid page response.');
  return { items: decodeArray(raw.items, decode), page: raw.page, hasMore: boolean(raw.hasMore) };
}
export function decodeComment(value: unknown): Comment {
  const raw = record(value);
  return {
    id: string(raw.id),
    threadId: string(raw.threadId),
    author: string(raw.author),
    body: string(raw.body),
    createdAt: string(raw.createdAt),
    resolved: boolean(raw.resolved),
    outdated: boolean(raw.outdated),
    location: string(raw.location),
  };
}
export function decodeCheck(value: unknown): Check {
  const raw = record(value);
  return {
    id: string(raw.id),
    name: string(raw.name),
    state: string(raw.state),
    conclusion: string(raw.conclusion),
    commit: string(raw.commit),
  };
}
