---
title: Netlify CLI functions command
description: Run netlify dev locally
---

# `functions`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->

Manage netlify functions
The `functions` command will help you manage the functions in this site

**Usage**

```bash
netlify functions
```

| Subcommand                                                        | description                                                                                                                                |
| :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| [`functions:build`](/docs/commands/functions.md#functionsbuild)   | Build functions locally                                                                                                                    |
| [`functions:create`](/docs/commands/functions.md#functionscreate) | Create a new function locally                                                                                                              |
| [`functions:invoke`](/docs/commands/functions.md#functionsinvoke) | Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions |

**Examples**

```bash
netlify functions:create --name function-xyz
netlify functions:build --name function-abc --timeout 30s
```

---

## `functions:build`

Build functions locally

**Usage**

```bash
netlify functions:build
```

**Flags**

- `functions` (_option_) - Specify a functions folder to build to
- `src` (_option_) - Specify the source folder for the functions

---

## `functions:create`

Create a new function locally

**Usage**

```bash
netlify functions:create
```

**Arguments**

- name - name of your new function file inside your functions folder

**Flags**

- `name` (_option_) - function name
- `url` (_option_) - pull template from URL

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

- `name` (_option_) - function name to invoke
- `functions` (_option_) - Specify a functions folder to parse, overriding netlify.toml
- `querystring` (_option_) - Querystring to add to your function invocation
- `payload` (_option_) - Supply POST payload in stringified json, or a path to a json file
- `identity` (_boolean_) - simulate Netlify Identity authentication JWT. pass --no-identity to affirm unauthenticated request
- `port` (_option_) - Port where netlify dev is accessible. e.g. 8888

**Examples**

```bash
$ netlify functions:invoke
$ netlify functions:invoke myfunction
$ netlify functions:invoke --name myfunction
$ netlify functions:invoke --name myfunction --identity
$ netlify functions:invoke --name myfunction --no-identity
$ netlify functions:invoke myfunction --payload "{"foo": 1}"
$ netlify functions:invoke myfunction --querystring "foo=1
$ netlify functions:invoke myfunction --payload "./pathTo.json"
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
