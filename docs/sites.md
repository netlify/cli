---
title: Netlify CLI sites command
description: Manage Netlify sites via the command line
---

# `sites`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Handle various site operations
The sites command will help you manage all your sites


**Usage**

```bash
netlify sites
```

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/sites#sitescreate) | Create an empty site (advanced)  |
| [`sites:list`](/sites#siteslist) | List all sites you have access to  |


**Examples**

```bash
netlify sites:create --name my-new-site
netlify sites:list
```

---
## `sites:create`

Create an empty site (advanced)

Create a blank site that isn't associated with any git remote.  Does not link to the current working directory.


**Usage**

```bash
netlify sites:create
```

**Flags**

- `name` (*option*) - name of site
- `account-slug` (*option*) - account slug to create the site under

---
## `sites:list`

List all sites you have access to

**Usage**

```bash
netlify sites:list
```

**Flags**

- `json` (*boolean*) - Output site data as JSON

---

<!-- AUTO-GENERATED-CONTENT:END -->
