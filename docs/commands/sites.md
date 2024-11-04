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

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/commands/sites#sitescreate) | Create an empty site (advanced)  |
| [`sites:create-template`](/commands/sites#sitescreate-template) | (Beta) Create a site from a starter template  |
| [`sites:delete`](/commands/sites#sitesdelete) | Delete a site  |
| [`sites:list`](/commands/sites#siteslist) | List all sites you have access to  |


**Examples**

```bash
netlify sites:create --name my-new-site
netlify sites:list
```

---
## `sites:create`

Create an empty site (advanced)
Create a blank site that isn't associated with any git remote. Will link the site to the current working directory.

**Usage**

```bash
netlify sites:create
```

**Flags**

- `account-slug` (*string*) - account slug to create the site under
- `disable-linking` (*boolean*) - create the site without linking it to current directory
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `manual` (*boolean*) - force manual CI setup.  Used --with-ci flag
- `name` (*string*) - name of site
- `with-ci` (*boolean*) - initialize CI hooks during site creation
- `debug` (*boolean*) - Print debugging information

---
## `sites:create-template`

(Beta) Create a site from a starter template
Create a site from a starter template.

**Usage**

```bash
netlify sites:create-template
```

**Arguments**

- repository - repository to use as starter template

**Flags**

- `account-slug` (*string*) - account slug to create the site under
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `name` (*string*) - name of site
- `url` (*string*) - template url
- `with-ci` (*boolean*) - initialize CI hooks during site creation
- `debug` (*boolean*) - Print debugging information

**Examples**

```bash
netlify sites:create-template
netlify sites:create-template nextjs-blog-theme
netlify sites:create-template my-github-profile/my-template
```

---
## `sites:delete`

Delete a site
This command will permanently delete the site on Netlify. Use with caution.

**Usage**

```bash
netlify sites:delete
```

**Arguments**

- siteId - Site ID to delete.

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Delete without prompting (useful for CI).
- `debug` (*boolean*) - Print debugging information

**Examples**

```bash
netlify sites:delete 1234-3262-1211
```

---
## `sites:list`

List all sites you have access to

**Usage**

```bash
netlify sites:list
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output site data as JSON
- `debug` (*boolean*) - Print debugging information

---

<!-- AUTO-GENERATED-CONTENT:END -->
