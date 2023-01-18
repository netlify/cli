---
title: Netlify CLI graph command
description: Sync and edit your Netlify Graph library
---

# `graph`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
(Beta) Control the Netlify Graph functions for the current site

**Usage**

```bash
netlify graph
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`graph:config:write`](/docs/commands/graph.md#graphconfigwrite) | Write a .graphqlrc.json file to the current directory for use with local tooling (e.g. the graphql extension for vscode)  |
| [`graph:edit`](/docs/commands/graph.md#graphedit) | Launch the browser to edit your local graph functions from Netlify  |
| [`graph:handler`](/docs/commands/graph.md#graphhandler) | Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.  |
| [`graph:init`](/docs/commands/graph.md#graphinit) | Initialize all the resources for Netlify Graph  |
| [`graph:library`](/docs/commands/graph.md#graphlibrary) | Generate the Graph function library  |
| [`graph:operations`](/docs/commands/graph.md#graphoperations) | List all of the locally available operations  |
| [`graph:pull`](/docs/commands/graph.md#graphpull) | Pull your remote Netlify Graph schema locally, and process pending Graph edit events  |


**Examples**

```bash
netlify graph:pull
netlify graph:edit
```

---
## `graph:config:write`

Write a .graphqlrc.json file to the current directory for use with local tooling (e.g. the graphql extension for vscode)

**Usage**

```bash
netlify graph:config:write
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `graph:edit`

Launch the browser to edit your local graph functions from Netlify

**Usage**

```bash
netlify graph:edit
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `graph:handler`

Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.

**Usage**

```bash
netlify graph:handler
```

**Arguments**

- name - Operation name(s)

**Flags**

- `codegen` (*string*) - The id of the specific code generator to use
- `data` (*string*) - Optional data to pass along to the code generator
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `graph:init`

Initialize all the resources for Netlify Graph

**Usage**

```bash
netlify graph:init
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `graph:library`

Generate the Graph function library

**Usage**

```bash
netlify graph:library
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `graph:operations`

List all of the locally available operations

**Usage**

```bash
netlify graph:operations
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `graph:pull`

Pull your remote Netlify Graph schema locally, and process pending Graph edit events

**Usage**

```bash
netlify graph:pull
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---

<!-- AUTO-GENERATED-CONTENT:END -->
