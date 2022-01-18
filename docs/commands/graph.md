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
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`graph:edit`](/docs/commands/graph.md#graphedit) | Launch the browser to edit your local graph functions from Netlify  |
| [`graph:pull`](/docs/commands/graph.md#graphpull) | Pull down your local Netlify Graph schema, and process pending Graph edit events  |


**Examples**

```bash
netlify graph:pull
netlify graph:edit
```

---
## `graph:edit`

Launch the browser to edit your local graph functions from Netlify

**Usage**

```bash
netlify graph:edit
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `graph:pull`

Pull down your local Netlify Graph schema, and process pending Graph edit events

**Usage**

```bash
netlify graph:pull
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

---

<!-- AUTO-GENERATED-CONTENT:END -->
