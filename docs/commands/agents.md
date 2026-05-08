---
title: Netlify CLI agents command
sidebar:
  label: agents
description: Manage Netlify AI agent tasks for automated development workflows
---

# `agents`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Manage Netlify AI agent tasks
The `agents` command will help you run AI agents on your Netlify sites to automate development tasks

Note: Agent tasks execute remotely on Netlify infrastructure, not locally.

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
| [`agents:archive`](/commands/agents#agentsarchive) | Archive an agent task  |
| [`agents:commit`](/commands/agents#agentscommit) | Commit an agent task’s changes directly to a branch  |
| [`agents:create`](/commands/agents#agentscreate) | Create and run a new agent task on your site  |
| [`agents:diff`](/commands/agents#agentsdiff) | Print the unified diff produced by an agent task  |
| [`agents:follow-up`](/commands/agents#agentsfollow-up) | Send a follow-up prompt to an existing agent task  |
| [`agents:list`](/commands/agents#agentslist) | List agent tasks for the current site  |
| [`agents:open`](/commands/agents#agentsopen) | Open the agent task preview, dashboard, or pull request in a browser  |
| [`agents:pr`](/commands/agents#agentspr) | Open a pull request for an agent task  |
| [`agents:publish`](/commands/agents#agentspublish) | Publish an agent task’s changes to production  |
| [`agents:redeploy`](/commands/agents#agentsredeploy) | Create a redeploy session that reapplies an existing diff (no AI inference)  |
| [`agents:revert`](/commands/agents#agentsrevert) | Revert an agent task to a specific session (sessions after it are discarded)  |
| [`agents:show`](/commands/agents#agentsshow) | Show details of a specific agent task  |
| [`agents:stop`](/commands/agents#agentsstop) | Stop a running agent task or session  |


**Examples**

```bash
netlify agents:create --prompt "Add a contact form"
netlify agents:list --status live
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --watch
netlify agents:follow-up 60c7c3b3e7b4a0001f5e4b3a "Also add tests"
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a
netlify agents:open 60c7c3b3e7b4a0001f5e4b3a
```

---
## `agents:archive`

Archive an agent task

**Usage**

```bash
netlify agents:archive
```

**Arguments**

- id - agent task ID

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `yes` (*boolean*) - skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:archive 60c7c3b3e7b4a0001f5e4b3a
netlify agents:archive 60c7c3b3e7b4a0001f5e4b3a --yes
```

---
## `agents:commit`

Commit an agent task’s changes directly to a branch

**Usage**

```bash
netlify agents:commit
```

**Arguments**

- id - agent task ID

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

Create and run a new agent task on your site

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
- `dev-server-image` (*string*) - custom dev server Docker image
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `from-deploy` (*string*) - start the agent from a specific deploy (mutually exclusive with --branch)
- `json` (*boolean*) - output result as JSON
- `mode` (*string*) - session mode (normal, create, ask)
- `model` (*string*) - model to use for the agent
- `parent` (*string*) - chain this agent task off of another agent task
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
netlify agents:create "Tell me about this codebase" --mode ask
```

---
## `agents:diff`

Print the unified diff produced by an agent task

**Usage**

```bash
netlify agents:diff
```

**Arguments**

- id - agent task ID

**Flags**

- `cumulative` (*boolean*) - with --session, show the cumulative diff up through that session
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `no-color` (*boolean*) - disable color in the output
- `no-strip-binary` (*boolean*) - include raw binary content in the diff (off by default)
- `page` (*string*) - page number (1-based)
- `per-page` (*string*) - files per page (max 100)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `project` (*string*) - project ID or name (if not in a linked directory)
- `session` (*string*) - show a single session diff instead of the task aggregate

**Examples**

```bash
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --page 2
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --session 70d8... --cumulative
netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --no-color | less
```

---
## `agents:follow-up`

Send a follow-up prompt to an existing agent task

**Usage**

```bash
netlify agents:follow-up
```

**Arguments**

- id - agent task ID to follow up on
- prompt - the follow-up prompt

**Flags**

- `agent` (*string*) - override agent type for this session
- `attach` (*string*) - attach a file or image (repeatable)
- `dev-server-image` (*string*) - custom dev server Docker image
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `model` (*string*) - override model for this session
- `project` (*string*) - project ID or name (if not in a linked directory)
- `prompt` (*string*) - follow-up prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:follow-up 60c7c3b3e7b4a0001f5e4b3a "Also add tests"
netlify agents:follow-up 60c7c3b3e7b4a0001f5e4b3a -p "Fix the lint error"
```

---
## `agents:list`

List agent tasks for the current site

**Usage**

```bash
netlify agents:list
```

**Flags**

- `account` (*string*) - list tasks across an account instead of just this site
- `branch` (*string*) - filter by branch
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `ndjson` (*boolean*) - output one JSON object per line
- `page` (*string*) - page number (1-based)
- `per-page` (*string*) - items per page (max 100)
- `project` (*string*) - project ID or name (if not in a linked directory)
- `since` (*string*) - only show tasks created on or after this ISO timestamp
- `status` (*string*) - filter by status (live, error)
- `title` (*string*) - filter by title (case-insensitive contains)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `until` (*string*) - only show tasks created on or before this ISO timestamp
- `user` (*string*) - filter by user ID

**Examples**

```bash
netlify agents:list
netlify agents:list --status live
netlify agents:list --branch main --since 2026-04-01
netlify agents:list --account my-team
netlify agents:list --ndjson
```

---
## `agents:open`

Open the agent task preview, dashboard, or pull request in a browser

**Usage**

```bash
netlify agents:open
```

**Arguments**

- id - agent task ID to open
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

Open a pull request for an agent task

**Usage**

```bash
netlify agents:pr
```

**Arguments**

- id - agent task ID

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

Publish an agent task’s changes to production

**Usage**

```bash
netlify agents:publish
```

**Arguments**

- id - agent task ID

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `yes` (*boolean*) - skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:publish 60c7c3b3e7b4a0001f5e4b3a
netlify agents:publish 60c7c3b3e7b4a0001f5e4b3a --yes
```

---
## `agents:redeploy`

Create a redeploy session that reapplies an existing diff (no AI inference)

**Usage**

```bash
netlify agents:redeploy
```

**Arguments**

- id - agent task ID

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

Revert an agent task to a specific session (sessions after it are discarded)

**Usage**

```bash
netlify agents:revert
```

**Arguments**

- id - agent task ID

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

Show details of a specific agent task

**Usage**

```bash
netlify agents:show
```

**Arguments**

- id - agent task ID to show

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `session` (*string*) - show details of a specific session within the task
- `watch` (*boolean*) - poll until the task reaches a terminal state
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

Stop a running agent task or session

**Usage**

```bash
netlify agents:stop
```

**Arguments**

- id - agent task ID to stop

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `session` (*string*) - stop a single session instead of the entire task
- `yes` (*boolean*) - skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a
netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a --session 70d8... --yes
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
