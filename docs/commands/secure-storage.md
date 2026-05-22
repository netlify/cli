---
title: Netlify CLI secure-storage command
sidebar:
  label: secure-storage
description: Control whether the Netlify auth token is stored in your OS keychain
---

# `secure-storage`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Control whether the Netlify auth token is stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) instead of in plaintext in the global netlify config file

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
| [`secure-storage:disable`](/commands/secure-storage#secure-storagedisable) | Disable secure storage of the Netlify auth token  |
| [`secure-storage:enable`](/commands/secure-storage#secure-storageenable) | Enable secure storage of the Netlify auth token in the OS keychain  |
| [`secure-storage:status`](/commands/secure-storage#secure-storagestatus) | Show the current secure storage status  |


**Examples**

```bash
netlify secure-storage:status
netlify secure-storage:enable
netlify secure-storage:disable
```

---
## `secure-storage:disable`

Disable secure storage of the Netlify auth token
Tokens previously stored in the OS keychain are moved back to the global netlify config file.

**Usage**

```bash
netlify secure-storage:disable
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `secure-storage:enable`

Enable secure storage of the Netlify auth token in the OS keychain
Existing tokens in the global netlify config file are migrated into the keychain.

**Usage**

```bash
netlify secure-storage:enable
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `secure-storage:status`

Show the current secure storage status
When enabled, the Netlify auth token is stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) instead of in plaintext in the global netlify config file.

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

