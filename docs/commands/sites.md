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
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create an empty site (advanced)  |
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

Create a blank site that isn't associated with any git remote.  Does not link to the current working directory.


**Usage**

```bash
netlify sites:create
```

**Flags**

- `name` (*string*) - name of site
- `account-slug` (*string*) - account slug to create the site under
- `with-ci` (*boolean*) - initialize CI hooks during site creation
- `manual` (*boolean*) - Force manual CI setup.  Used --with-ci flag
- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

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
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

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
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

---

<!-- AUTO-GENERATED-CONTENT:END -->
