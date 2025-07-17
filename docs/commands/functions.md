---
title: Netlify CLI functions command
sidebar:
  label: functions
description: Run netlify dev locally
---

# `functions`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Manage netlify functions
The `functions` command will help you manage the functions in this project

**Usage**

```bash
netlify functions
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`functions:build`](/commands/functions#functionsbuild) | Build functions locally  |
| [`functions:create`](/commands/functions#functionscreate) | Create a new function locally  |
| [`functions:invoke`](/commands/functions#functionsinvoke) | Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions  |
| [`functions:list`](/commands/functions#functionslist) | List functions that exist locally  |
| [`functions:serve`](/commands/functions#functionsserve) | Serve functions locally  |


**Examples**

```bash
netlify functions:create --name function-xyz
netlify functions:build --functions build/to/directory --src source/directory
```

---
## `functions:build`

Build functions locally

**Usage**

```bash
netlify functions:build
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `functions` (*string*) - Specify a functions directory to build to
- `src` (*string*) - Specify the source directory for the functions
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `functions:create`

Create a new function locally

**Usage**

```bash
netlify functions:create
```

**Arguments**

- name - name of your new function file inside your functions directory

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `language` (*string*) - function language
- `name` (*string*) - function name
- `offline` (*boolean*) - Disables any features that require network access
- `url` (*string*) - pull template from URL
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify functions:create
netlify functions:create hello-world
netlify functions:create --name hello-world
```

---
## `functions:invoke`

Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions

**Usage**

```bash
netlify functions:invoke
```

**Arguments**

- name - function name to invoke

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `functions` (*string*) - Specify a functions folder to parse, overriding netlify.toml
- `identity` (*boolean*) - simulate Netlify Identity authentication JWT. pass --identity to affirm unauthenticated request
- `name` (*string*) - function name to invoke
- `no-identity` (*boolean*) - simulate Netlify Identity authentication JWT. pass --no-identity to affirm unauthenticated request
- `offline` (*boolean*) - Disables any features that require network access
- `payload` (*string*) - Supply POST payload in stringified json, or a path to a json file
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `port` (*string*) - Port where netlify dev is accessible. e.g. 8888
- `querystring` (*string*) - Querystring to add to your function invocation

**Examples**

```bash
netlify functions:invoke
netlify functions:invoke myfunction
netlify functions:invoke --name myfunction
netlify functions:invoke --name myfunction --identity
netlify functions:invoke --name myfunction --no-identity
netlify functions:invoke myfunction --payload '{"foo": 1}'
netlify functions:invoke myfunction --querystring "foo=1
netlify functions:invoke myfunction --payload "./pathTo.json"
```

---
## `functions:list`

List functions that exist locally
Helpful for making sure that you have formatted your functions correctly

NOT the same as listing the functions that have been deployed. For that info you need to go to your Netlify deploy log.

**Usage**

```bash
netlify functions:list
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `functions` (*string*) - Specify a functions directory to list
- `json` (*boolean*) - Output function data as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `functions:serve`

Serve functions locally

**Usage**

```bash
netlify functions:serve
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `functions` (*string*) - Specify a functions directory to serve
- `offline` (*boolean*) - Disables any features that require network access
- `port` (*string*) - Specify a port for the functions server
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---

<!-- AUTO-GENERATED-CONTENT:END -->
