import { createAdapter } from './adapter.js';
import { runCodebase } from './cli.js';

try {
  const status = await createAdapter(runCodebase).status();
  // Deliberately print no real user, email, credential source, URL or path.
  console.log(
    JSON.stringify({
      state: status.state,
      hasStableIdentity: status.state === 'connected' && Boolean(status.user.id),
    }),
  );
} catch {
  console.error('Local CLI check failed. Run codebase auth status directly on the server to investigate.');
  process.exitCode = 1;
}
