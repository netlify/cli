---
title: Netlify CLI link command
sidebar:
  label: link
description: Link an existing project to a local project directory
---

# `link`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Link a local repo or project folder to an existing project on Netlify

**Usage**

```bash
netlify link
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `git-remote-name` (*string*) - Name of Git remote to use. e.g. "origin"
- `git-remote-url` (*string*) - URL of the repository (or Github `owner/repo`) to link to
- `id` (*string*) - ID of project to link to
- `name` (*string*) - Name of project to link to

**Examples**

```bash
netlify link
netlify link --id 123-123-123-123
netlify link --name my-project-name
netlify link --git-remote-url https://github.com/vibecoder/my-unicorn.git
```


<!-- AUTO-GENERATED-CONTENT:END -->
