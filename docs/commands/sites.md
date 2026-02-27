---
title: Netlify CLI sites command
sidebar:
  label: sites
description: Manage Netlify projects via the command line
---

# `sites`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Handle various project operations
The sites command will help you manage all your projects

**Usage**

```bash
netlify sites
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/commands/sites#sitescreate) | Create an empty project (advanced)  |
| [`sites:delete`](/commands/sites#sitesdelete) | Delete a project  |
| [`sites:list`](/commands/sites#siteslist) | List all projects you have access to  |


**Examples**

```bash
netlify sites:create --name my-new-project
netlify sites:list
```

---
## `sites:create`

Create an empty project (advanced)
Create a blank project that isn't associated with any git remote. Will link the project to the current working directory.

**Usage**

```bash
netlify sites:create
```

**Flags**

- `account-slug` (*string*) - account slug to create the project under
- `disable-linking` (*boolean*) - create the project without linking it to current directory
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `manual` (*boolean*) - force manual CI setup.  Used --with-ci flag
- `name` (*string*) - name of project
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `with-ci` (*boolean*) - initialize CI hooks during project creation

---
## `sites:delete`

Delete a project
This command will permanently delete the project on Netlify. Use with caution.

**Usage**

```bash
netlify sites:delete
```

**Arguments**

- id - Project ID to delete.

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Delete without prompting (useful for CI).

**Examples**

```bash
netlify sites:delete 1234-3262-1211
```

---
## `sites:list`

List all projects you have access to

**Usage**

```bash
netlify sites:list
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output project data as JSON

---

<!-- AUTO-GENERATED-CONTENT:END -->
