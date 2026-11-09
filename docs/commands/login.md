---
title: Netlify CLI login command
sidebar:
  label: login
description: Login to your Netlify account
---

# `login`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Login to your Netlify account
Opens a web browser to acquire an OAuth token, which is stored in your operating system's keychain
(macOS Keychain, Windows Credential Manager or Linux Secret Service) when available.
To store it in a plaintext config file instead, set NETLIFY_USE_LEGACY_AUTH_STORAGE=1. This is not recommended.

**Usage**

```bash
netlify login
```

**Flags**

- `check` (*string*) - Check the status of a login ticket created with --request
- `json` (*boolean*) - Output as JSON (for use with --request or --check)
- `new` (*boolean*) - Login to new Netlify account
- `request` (*string*) - Create a login ticket for agent/human-in-the-loop auth
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in


<!-- AUTO-GENERATED-CONTENT:END -->
