export type User = { id: string; login: string };
export type LoginStatus = { state: 'connected'; user: User } | { state: 'disconnected'; message: string };

// These are the example's presentation models, not copies of SDK provider DTOs.
export type MergeRequest = {
  number: number;
  title: string;
  state: string;
  url: string;
  head: string;
  base: string;
  headSha: string;
  author: string;
  description: string;
};
export type Page<T> = { items: T[]; page: number; hasMore: boolean };
export type Comment = {
  id: string;
  threadId: string;
  author: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  outdated: boolean;
  location: string;
};
export type Check = { id: string; name: string; state: string; conclusion: string; commit: string };
