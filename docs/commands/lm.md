---
title: Netlify CLI lm command
---

# `lm`

## About

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Handle Netlify Large Media operations
The lm command will help you manage large media for a site

**Usage**

```bash
netlify lm
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`lm:info`](/docs/commands/lm.md#lminfo) | Show large media requirements information.  |
| [`lm:install`](/docs/commands/lm.md#lminstall) | Configures your computer to use Netlify Large Media  |
| [`lm:setup`](/docs/commands/lm.md#lmsetup) | Configures your site to use Netlify Large Media  |


**Examples**

```bash
netlify lm:info
netlify lm:install
netlify lm:setup
```

---
## `lm:info`

Show large media requirements information.

**Usage**

```bash
netlify lm:info
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `lm:install`

Configures your computer to use Netlify Large Media
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.

**Usage**

```bash
netlify lm:install
```

**Flags**

- `force` (*boolean*) - Force the credentials helper installation
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `lm:setup`

Configures your site to use Netlify Large Media

**Usage**

```bash
netlify lm:setup
```

**Flags**

- `force-install` (*boolean*) - Force the credentials helper installation
- `skip-install` (*boolean*) - Skip the credentials helper installation check
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---

<!-- AUTO-GENERATED-CONTENT:END -->
