---
title: Netlify CLI agents command
sidebar:
  label: agents
description: Manage Netlify AI agent runs for automated development workflows
---

# `agents`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Manage Netlify AI agent runs
The `agents` command will help you run AI agents on your Netlify sites to automate development tasks

Note: Agent runs execute remotely on Netlify infrastructure, not locally.

**Usage**

```bash
netlify agents
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`agents:commit`](/commands/agents#agentscommit) | Commit an agent run’s changes directly to a branch  |
| [`agents:create`](/commands/agents#agentscreate) | Create and start a new agent run on your site  |
| [`agents:diff`](/commands/agents#agentsdiff) | Print the code changes produced by an agent run  |
| [`agents:list`](/commands/agents#agentslist) | List agent runs for the current site  |
| [`agents:open`](/commands/agents#agentsopen) | Open the agent run preview, dashboard, or pull request in a browser  |
| [`agents:pr`](/commands/agents#agentspr) | Open a pull request for an agent run  |
| [`agents:publish`](/commands/agents#agentspublish) | Publish an agent run’s changes to production  |
| [`agents:redeploy`](/commands/agents#agentsredeploy) | Redeploy an agent run by reapplying its existing changes (no AI inference)  |
| [`agents:revert`](/commands/agents#agentsrevert) | Revert an agent run to a specific session (sessions after it are discarded)  |
| [`agents:show`](/commands/agents#agentsshow) | Show details of a specific agent run  |
| [`agents:stop`](/commands/agents#agentsstop) | Stop a running agent run  |
| [`agents:sync`](/commands/agents#agentssync) | Bring an agent run up to date with the latest code from its base branch  |


**Examples**

```bash
netlify agents:create --prompt "Add a contact form"
netlify agents:list --status running
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --watch
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a
netlify agents:open 60c7c3b3e7b4a0001f5e4b3a
```

---
## `agents:commit`

Commit an agent run’s changes directly to a branch

**Usage**

```bash
netlify agents:commit
```

**Arguments**

- id - agent run ID

**Flags**

- `branch` (*string*) - target branch to commit to
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `project` (*string*) - project ID or name (if not in a linked directory)

**Examples**

```bash
netlify agents:commit 60c7c3b3e7b4a0001f5e4b3a --branch staging
```

---
## `agents:create`

Create and start a new agent run on your site

**Usage**

```bash
netlify agents:create
```

**Arguments**

- prompt - the prompt for the agent to execute

**Flags**

- `agent` (*string*) - agent type (claude, codex, gemini)
- `attach` (*string*) - attach a file or image (repeatable)
- `branch` (*string*) - git branch to work on
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `from-deploy` (*string*) - start the agent from a specific deploy (mutually exclusive with --branch)
- `json` (*boolean*) - output result as JSON
- `model` (*string*) - model to use for the agent
- `parent` (*string*) - chain this agent run off of another agent run
- `project` (*string*) - project ID or name (if not in a linked directory)
- `prompt` (*string*) - agent prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:create
netlify agents:create "Fix the login bug"
netlify agents:create --prompt "Add dark mode" --agent claude
netlify agents:create -p "Update README" -a codex -b feature-branch
netlify agents:create "Triage this error" --attach error.log --attach screenshot.png
```

---
## `agents:diff`

Print the code changes produced by an agent run

**Usage**

```bash
netlify agents:diff
```

**Arguments**

- id - agent run ID

**Flags**

- `cumulative` (*boolean*) - with --session, show the cumulative diff up through that session
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `no-color` (*boolean*) - disable color in the output
- `no-strip-binary` (*boolean*) - include raw binary content in the diff (binary is stripped by default)
- `page` (*string*) - page number (1-based)
- `per-page` (*string*) - files per page (max 100)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `project` (*string*) - project ID or name (if not in a linked directory)
- `session` (*string*) - show a single session diff instead of the run aggregate

**Examples**

```bash
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --page 2
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --session 70d8... --cumulative
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --no-color | less
```

---
## `agents:list`

List agent runs for the current site

**Usage**

```bash
netlify agents:list
```

**Flags**

- `account` (*string*) - list runs across an account instead of just this site
- `branch` (*string*) - filter by branch
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `ndjson` (*boolean*) - output one JSON object per line
- `page` (*string*) - page number (1-based)
- `per-page` (*string*) - items per page (max 100)
- `project` (*string*) - project ID or name (if not in a linked directory)
- `since` (*string*) - only show runs created on or after this ISO timestamp
- `status` (*string*) - filter by status (running, done, error, archived)
- `title` (*string*) - filter by title (case-insensitive contains)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `until` (*string*) - only show runs created on or before this ISO timestamp
- `user` (*string*) - filter by user ID

**Examples**

```bash
netlify agents:list
netlify agents:list --status running
netlify agents:list --status archived
netlify agents:list --branch main --since 2026-04-01
netlify agents:list --account my-team
netlify agents:list --ndjson
```

---
## `agents:open`

Open the agent run preview, dashboard, or pull request in a browser

**Usage**

```bash
netlify agents:open
```

**Arguments**

- id - agent run ID to open
- target - what to open: preview (default), dashboard, or pr

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `project` (*string*) - project ID or name (if not in a linked directory)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:open 60c7c3b3e7b4a0001f5e4b3a
netlify agents:open 60c7c3b3e7b4a0001f5e4b3a dashboard
netlify agents:open 60c7c3b3e7b4a0001f5e4b3a pr
```

---
## `agents:pr`

Open a pull request for an agent run

**Usage**

```bash
netlify agents:pr
```

**Arguments**

- id - agent run ID

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:pr 60c7c3b3e7b4a0001f5e4b3a
```

---
## `agents:publish`

Publish an agent run’s changes to production

**Usage**

```bash
netlify agents:publish
```

**Arguments**

- id - agent run ID

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - publish even when the run is out of sync with production
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `yes` (*boolean*) - skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:publish 60c7c3b3e7b4a0001f5e4b3a
netlify agents:publish 60c7c3b3e7b4a0001f5e4b3a --yes
netlify agents:publish 60c7c3b3e7b4a0001f5e4b3a --force
```

---
## `agents:redeploy`

Redeploy an agent run by reapplying its existing changes (no AI inference)

**Usage**

```bash
netlify agents:redeploy
```

**Arguments**

- id - agent run ID

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `session` (*string*) - redeploy a specific session (defaults to the latest completed one)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:redeploy 60c7c3b3e7b4a0001f5e4b3a
netlify agents:redeploy 60c7c3b3e7b4a0001f5e4b3a --session 70d8...
```

---
## `agents:revert`

Revert an agent run to a specific session (sessions after it are discarded)

**Usage**

```bash
netlify agents:revert
```

**Arguments**

- id - agent run ID

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `session` (*string*) - session ID to revert to
- `yes` (*boolean*) - skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:revert 60c7c3b3e7b4a0001f5e4b3a --session 70d8...
```

---
## `agents:show`

Show details of a specific agent run

**Usage**

```bash
netlify agents:show
```

**Arguments**

- id - agent run ID to show

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `session` (*string*) - show details of a specific session within the run
- `watch` (*boolean*) - poll until the run reaches a terminal state
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --watch
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --session 70d8...
```

---
## `agents:stop`

Stop a running agent run

**Usage**

```bash
netlify agents:stop
```

**Arguments**

- id - agent run ID to stop

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `yes` (*boolean*) - skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a
netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a --yes
```

---
## `agents:sync`

Bring an agent run up to date with the latest code from its base branch

**Usage**

```bash
netlify agents:sync
```

**Arguments**

- id - agent run ID

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `yes` (*boolean*) - skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:sync 60c7c3b3e7b4a0001f5e4b3a
netlify agents:sync 60c7c3b3e7b4a0001f5e4b3a --yes
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
