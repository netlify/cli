---
title: Netlify CLI open command
---

# `open`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Open settings for the site linked to the current folder

**Usage**

```bash
netlify open
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server
- `site` (*boolean*) - Open site
- `admin` (*boolean*) - Open Netlify site

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/docs/commands/open.md#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/docs/commands/open.md#opensite) | Opens current site url in browser  |


**Examples**

```bash
netlify open --site
netlify open --admin
netlify open:admin
netlify open:site
```

---
## `open:admin`

Opens current site admin UI in Netlify

**Usage**

```bash
netlify open:admin
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

**Examples**

```bash
netlify open:admin
```

---
## `open:site`

Opens current site url in browser

**Usage**

```bash
netlify open:site
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

**Examples**

```bash
netlify open:site
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
