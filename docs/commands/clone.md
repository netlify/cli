---
title: Netlify CLI clone command
sidebar:
  label: clone
description: Clone a remote repo and link it to an existing project on Netlify
---

# `clone`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Clone a repository and link it to a Netlify project

You can clone from:
- A GitHub/GitLab repository URL or shorthand (e.g., owner/repo)
- A Netlify site name (e.g., my-site)
- A Netlify site URL (e.g., https://my-site.netlify.app)

When cloning a Netlify site that has a connected repository, the repository will be cloned from the connected source (GitHub, GitLab, etc.).

When cloning a Netlify site without a connected repository, the repository will be cloned from Netlify's managed git service with automatic credential configuration.

If you specify a target directory, the repo will be cloned into that directory. By default, a directory will be created with the name of the repo or site.

**Usage**

```bash
netlify clone
```

**Arguments**

- repository - Repository URL, GitHub shorthand (owner/repo), Netlify site name, or Netlify site URL
- targetDir - directory in which to clone the repository - will be created if it does not exist

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `id` (*string*) - ID of existing Netlify project to link to (only for GitHub/GitLab repos)
- `name` (*string*) - Name of existing Netlify project to link to (only for GitHub/GitLab repos)

**Examples**

```bash
netlify clone my-site-name
netlify clone https://my-site.netlify.app
netlify clone https://app.netlify.com/sites/my-site
netlify clone vibecoder/next-unicorn
netlify clone https://github.com/vibecoder/next-unicorn.git
netlify clone my-site-name ./local-folder
```


<!-- AUTO-GENERATED-CONTENT:END -->
