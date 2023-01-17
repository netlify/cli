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

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create an empty site (advanced)  |
| [`sites:create-template`](/docs/commands/sites.md#sitescreate-template) | (Beta) Create a site from a starter template  |
| [`sites:delete`](/docs/commands/sites.md#sitesdelete) | Delete a site  |
| [`sites:list`](/docs/commands/sites.md#siteslist) | List all sites you have access to  |


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
- `manual` (*boolean*) - force manual CI setup.  Used --with-ci flag
- `name` (*string*) - name of site
- `with-ci` (*boolean*) - initialize CI hooks during site creation
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

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
- `name` (*string*) - name of site
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server
- `url` (*string*) - template url
- `with-ci` (*boolean*) - initialize CI hooks during site creation

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

- `force` (*boolean*) - delete without prompting (useful for CI)
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

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

- `json` (*boolean*) - Output site data as JSON
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---

<!-- AUTO-GENERATED-CONTENT:END -->
