---
title: Netlify CLI link command
sidebar:
  label: link
description: Link an existing site to a local site directory
---

# `link`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Link a local repo or project folder to an existing site on Netlify

**Usage**

```bash
netlify link
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `git-remote-name` (*string*) - Name of Git remote to use. e.g. "origin"
- `id` (*string*) - ID of site to link to
- `name` (*string*) - Name of site to link to
- `debug` (*boolean*) - Print debugging information

**Examples**

```bash
netlify link
netlify link --id 123-123-123-123
netlify link --name my-site-name
```


<!-- AUTO-GENERATED-CONTENT:END -->
