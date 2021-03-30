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

| Subcommand | description  |
|:--------------------------- |:-----|
| [`functions:build`](/docs/commands/functions.md#functionsbuild) | Build functions locally  |
| [`functions:create`](/docs/commands/functions.md#functionscreate) | Create a new function locally  |
| [`functions:invoke`](/docs/commands/functions.md#functionsinvoke) | Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions  |
| [`functions:list`](/docs/commands/functions.md#functionslist) | List functions that exist locally  |


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

- `functions` (*string*) - Specify a functions folder to build to
- `src` (*string*) - Specify the source folder for the functions
- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

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

- `name` (*string*) - function name
- `url` (*string*) - pull template from URL
- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

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

- `name` (*string*) - function name to invoke
- `functions` (*string*) - Specify a functions folder to parse, overriding netlify.toml
- `querystring` (*string*) - Querystring to add to your function invocation
- `payload` (*string*) - Supply POST payload in stringified json, or a path to a json file
- `identity` (*boolean*) - simulate Netlify Identity authentication JWT. pass --no-identity to affirm unauthenticated request
- `port` (*string*) - Port where netlify dev is accessible. e.g. 8888
- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

**Examples**

```bash
$ netlify functions:invoke
$ netlify functions:invoke myfunction
$ netlify functions:invoke --name myfunction
$ netlify functions:invoke --name myfunction --identity
$ netlify functions:invoke --name myfunction --no-identity
$ netlify functions:invoke myfunction --payload '{"foo": 1}'
$ netlify functions:invoke myfunction --querystring "foo=1
$ netlify functions:invoke myfunction --payload "./pathTo.json"
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

- `name` (*string*) - name to print
- `functions` (*string*) - Specify a functions folder to serve
- `json` (*boolean*) - Output function data as JSON
- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

---

<!-- AUTO-GENERATED-CONTENT:END -->
