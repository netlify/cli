---
title: Netlify CLI build command
sidebar:
  label: build
---

# `build`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Build on your local machine

**Usage**

```bash
netlify build
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `context` (*string*) - Specify a deploy context for environment variables read during the build (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: value of CONTEXT or ”production”)
- `dry` (*boolean*) - Dry run: show instructions without running them
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `offline` (*boolean*) - Disables any features that require network access

**Examples**

```bash
netlify build
netlify build --context deploy-preview # Build with env var values from deploy-preview context
netlify build --context branch:feat/make-it-pop # Build with env var values from the feat/make-it-pop branch context or branch-deploy context
```


<!-- AUTO-GENERATED-CONTENT:END -->
