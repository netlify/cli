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

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`agents:create`](/commands/agents#agentscreate) | Create and run a new agent task on your site  |
| [`agents:list`](/commands/agents#agentslist) | List agent tasks for the current site  |
| [`agents:show`](/commands/agents#agentsshow) | Show details of a specific agent task  |
| [`agents:stop`](/commands/agents#agentsstop) | Stop a running agent task  |


**Examples**

```bash
netlify agents:create --prompt "Add a contact form"
netlify agents:list --status running
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a
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
- `branch` (*string*) - git branch to work on
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `model` (*string*) - model to use for the agent
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
netlify agents:create "Add tests" --project my-site-name
```

---
## `agents:list`

List agent tasks for the current site

**Usage**

```bash
netlify agents:list
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)
- `status` (*string*) - filter by status (new, running, done, error, cancelled)

**Examples**

```bash
netlify agents:list
netlify agents:list --status running
netlify agents:list --json
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

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)

**Examples**

```bash
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a
netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --json
```

---
## `agents:stop`

Stop a running agent task

**Usage**

```bash
netlify agents:stop
```

**Arguments**

- id - agent task ID to stop

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `project` (*string*) - project ID or name (if not in a linked directory)

**Examples**

```bash
netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
