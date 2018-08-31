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
| [`sites:create`](/commands/sites#sitescreate) | Create a new site  |
| [`sites:list`](/commands/sites#siteslist) | List existing sites  |


**Examples**

```bash
$ netlify sites:create --name my-new-site
$ netlify sites:list
```

---
## `sites:create`

Create a new site

**Usage**

```bash
netlify sites:create
```

**Flags**

- name (option) - name of site
- password (option) - password protect the site
- force-tls (boolean) - force TLS connections
- session-id (option) - session ID for later site transfers
- account-slug (option) - account slug to create the site under
- custom-domain (option) - custom domain to use with the site

---
## `sites:list`

List existing sites

**Usage**

```bash
netlify sites:list
```

**Flags**

- json (boolean) - Output site data as JSON

---

<!-- AUTO-GENERATED-CONTENT:END -->
