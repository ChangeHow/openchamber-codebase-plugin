# Codebase CLI example

This OpenChamber extension reads merge requests through an existing `codebase` executable on the OpenChamber server. The CLI owns login and credential storage. Users install and sign into it separately. This package does not include the CLI, private SDKs, API endpoints or login implementation.

All checked-in repositories, users, comments, checks and commit IDs are synthetic. The preview can run without the CLI or access to a forge.

# Standalone preview

Use Node.js 22.18 or newer:

```sh
npm install
npm run dev
```

Open the printed localhost URL. Enter `example/team-repo`, load MR `!42`, inspect its comments/checks, and attach an MR, CI instruction or comment to the preview composer. The theme selector exercises light/dark SDK tokens. The preview uses synthetic data and never runs the real CLI or performs Git operations.

# Build and verify

```sh
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run smoke
```

Install the generated `dist` folder through OpenChamber Settings → Extensions, then approve its local service. OpenChamber must have the CLI on `PATH` and access to the user's credential store. Login and reauthorization remain manual CLI actions on that server. The extension never requests or exports a Codebase token.

The service has the same user-level access as other approved local services. Existing host policy and extension approval still apply. Browser bundles are classic IIFEs; service scripts are precompiled Node.js modules. The build validates the packaged manifest against the public SDK.

# Supported reads

- Login status and a stable user ID, without raw authentication diagnostics.
- Paged MR lists and selected MR details.
- Published comments sorted by timestamp, including resolved/outdated markers and source locations. Draft comments stay out of the inspector.
- Check metadata and CI instruction attachments that tell the agent to read details on demand.
- Existing SDK attachments and `/codebase-mr example/team-repo 42` or `/codebase-ci example/team-repo 42` commands.

Attachments remain in the composer until the user sends them. The default MR attachment contains identity, URL and branch metadata. Descriptions, comments, diffs and CI logs are not loaded into model context automatically. A comment is included only after the user selects it. Account changes during resource reads discard the result.

# Native integration boundary

[OpenChamber issue #6558](https://github.com/openchamber/openchamber/issues/6558) requests extension-owned sign-in for native source-control providers. The current example declares only existing panel, local-service, attach and command contributions. It does not invent a native auth manifest key or provide a fake PAT.

Native MR pickers, rendering and exact MR/worktree checkout still depend on the host contract. Generic attachment branch metadata does not implement exact checkout. This standalone panel has no verified mobile support; the requested native workflow includes phone use.

Clone, fetch and push remain system Git SSH/HTTPS operations. This example performs no Git mutations, forge writes, CI reruns, review resolution or login automation. It does not parse free-form comments as structured AICR findings.

# CLI commands

These observed commands emit JSON by default. The repository and MR are placeholders; there is no blanket `--json` flag:

```sh
codebase auth status
codebase user view
codebase mr list -R example/team-repo --page 1 --page-size 20
codebase mr view -R example/team-repo -N 42 --verbose
codebase mr comment list -R example/team-repo -N 42
codebase mr checks list -R example/team-repo -N 42 --page 1 --page-size 20
```

After building, `npm run smoke:local` checks the real CLI's login only. It prints connected state and identity availability without the user's account fields. The default tests and smoke use synthetic data.

# Privacy and publication

Do not add real CLI responses, credentials, users, repository paths, internal URLs, pipeline logs or local configuration to this package. Source maps are disabled and npm publication is blocked by `private: true`.

The GitHub example repository must remain private during owner review. Making it public requires separate approval.
