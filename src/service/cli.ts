import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type RunCli = (args: string[]) => Promise<unknown>;
const execute = promisify(execFile);

export class CliError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CliError('INVALID_RESPONSE', 'The CLI returned an unexpected response.');
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new CliError('INVALID_RESPONSE', 'The CLI did not return a list.');
  return value;
}

export function checked(value: unknown): Record<string, unknown> {
  const data = object(value);
  const metadata = data.ResponseMetadata;
  if (data.Error || data.Code || (metadata && object(metadata).Error)) {
    // Never copy raw CLI errors, request headers, private URLs or paths to a frame.
    throw new CliError('CLI_QUERY_FAILED', 'The CLI query failed. Check CLI access on the server.');
  }
  return data;
}

export const runCodebase: RunCli = async (args) => {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [
    'PATH',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'TMPDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'SystemRoot',
  ]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  let stdout: string;
  try {
    ({ stdout } = await execute('codebase', args, {
      env,
      encoding: 'utf8',
      timeout: 6_000,
      maxBuffer: 2_000_000,
      windowsHide: true,
    }));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new CliError('CLI_MISSING', 'Install the CLI on the OpenChamber server.', 503);
    }
    throw new CliError('CLI_FAILED', 'The CLI could not complete the request. Check it on the server.', 503);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new CliError('INVALID_RESPONSE', 'The CLI returned invalid JSON.');
  }
};
