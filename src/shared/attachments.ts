import type { AttachIssueRequest } from '@openchamber/sdk';

import type { Comment, MergeRequest } from './model.js';

export function mrAttachment(repo: string, mr: MergeRequest): AttachIssueRequest {
  return {
    providerId: 'codebase-cli-example',
    id: `${repo}!${mr.number}`,
    title: mr.title,
    url: mr.url,
    kind: 'pull',
    author: mr.author || undefined,
    branches: { head: mr.head, base: mr.base },
    text: `MR !${mr.number}: ${mr.title}\nRepository: ${repo}\n${mr.url}`,
  };
}

export function ciAttachment(repo: string, mr: MergeRequest): AttachIssueRequest {
  const pinned = /^[0-9a-f]{40}$/i.test(mr.headSha) ? ` --commit-id ${mr.headSha}` : '';
  return {
    ...mrAttachment(repo, mr),
    id: `${repo}!${mr.number}:ci`,
    title: `CI for MR !${mr.number}`,
    text: [
      `Investigate CI for MR !${mr.number} in ${repo}.`,
      `Run on the OpenChamber server: codebase mr checks list -R ${repo} -N ${mr.number}${pinned}`,
      'The command returns JSON. Inspect failed checks; use codebase mr checks view with their IDs.',
      "If a check only contains a pipeline/log reference, use the organization's available log-reading tool.",
      'Read logs on demand. This attachment does not authorize rerunning CI, pushing code or changing platform state.',
    ].join('\n'),
  };
}

export function commentAttachment(repo: string, mr: MergeRequest, comment: Comment): AttachIssueRequest {
  return {
    ...mrAttachment(repo, mr),
    id: `${repo}!${mr.number}:comment:${comment.id}`,
    title: `MR !${mr.number} comment by ${comment.author}`,
    text: [`MR: ${mr.url}`, `Thread: ${comment.threadId}`, comment.location, comment.body]
      .filter(Boolean)
      .join('\n\n'),
  };
}
