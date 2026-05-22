---
title: Netlify CLI secure-storage command
sidebar:
  label: secure-storage
description: Inspect where the Netlify auth token is stored on this machine
---

# `secure-storage`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Inspect where the Netlify auth token is stored on this machine. By default tokens are stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

**Usage**

```bash
netlify secure-storage
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`secure-storage:status`](/commands/secure-storage#secure-storagestatus) | Show where the Netlify auth token is stored on this machine  |


**Examples**

```bash
netlify secure-storage:status
```

---
## `secure-storage:status`

Show where the Netlify auth token is stored on this machine
By default the token is stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service). If the keychain is unreachable, the CLI falls back to the global netlify config file. Set NETLIFY_USE_LEGACY_AUTH_STORAGE=1 to force the legacy plaintext mode.

**Usage**

```bash
netlify secure-storage:status
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---

<!-- AUTO-GENERATED-CONTENT:END -->

