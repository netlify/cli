---
title: Netlify CLI clone command
sidebar:
  label: clone
description: Clone a remote repo and link it to an existing project on Netlify
---

# `clone`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Clone a remote repository and link it to an existing project on Netlify
Use this command when the existing Netlify project is already configured to deploy from the existing repo.

If you specify a target directory, the repo will be cloned into that directory. By default, a directory will be created with the name of the repo.

To specify a project, use --id or --name. By default, the Netlify project to link will be automatically detected if exactly one project found is found with a matching git URL. If we cannot find such a project, you will be interactively prompted to select one.

**Usage**

```bash
netlify clone
```

**Arguments**

- repo - URL of the repository to clone or Github `owner/repo` (required)
- targetDir - directory in which to clone the repository - will be created if it does not exist

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `id` (*string*) - ID of existing Netlify project to link to
- `name` (*string*) - Name of existing Netlify project to link to

**Examples**

```bash
netlify clone vibecoder/next-unicorn
netlify clone https://github.com/vibecoder/next-unicorn.git
netlify clone git@github.com:vibecoder/next-unicorn.git
netlify clone vibecoder/next-unicorn ./next-unicorn-shh-secret
netlify clone --id 123-123-123-123 vibecoder/next-unicorn
netlify clone --name my-project-name vibecoder/next-unicorn
```


<!-- AUTO-GENERATED-CONTENT:END -->
