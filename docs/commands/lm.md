---
title: Netlify CLI lm command
---

# `lm`

## About

> ⚠️ The Large Media feature was deprecated on September 1st, 2023 and will become unavailable in a future update. [Learn more and discover alternative solutions](https://answers.netlify.com/t/large-media-feature-deprecated-but-not-removed/100804)

Handle Netlify Large Media operations

The lm command will help you manage large media for a site

**Usage**

```bash
netlify lm
```

**Flags**

- `debug` (*boolean*) - Print debugging information

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

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

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

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Force the credentials helper installation
- `debug` (*boolean*) - Print debugging information

---
## `lm:setup`

Configures your site to use Netlify Large Media

**Usage**

```bash
netlify lm:setup
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force-install` (*boolean*) - Force the credentials helper installation
- `skip-install` (*boolean*) - Skip the credentials helper installation check
- `debug` (*boolean*) - Print debugging information

---
<!-- AUTO-GENERATED-CONTENT:END -->
