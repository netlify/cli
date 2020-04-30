---
title: Netlify CLI Commands List
description: All netlify CLI command
---

# Available CLI Commands

To get a list of commands, run

```
netlify help
```

To get a list of available sub-commands, arguments & flags run

```
netlify [command] help
```

## Commands

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_LIST) -->

### [addons](/docs/commands/addons.md)

(Beta) Manage Netlify Add-ons

| Subcommand                                               | description                               |
| :------------------------------------------------------- | :---------------------------------------- |
| [`addons:auth`](/docs/commands/addons.md#addonsauth)     | Login to add-on provider                  |
| [`addons:config`](/docs/commands/addons.md#addonsconfig) | Configure add-on settings                 |
| [`addons:create`](/docs/commands/addons.md#addonscreate) | Add an add-on extension to your site      |
| [`addons:delete`](/docs/commands/addons.md#addonsdelete) | Remove an add-on extension to your site   |
| [`addons:list`](/docs/commands/addons.md#addonslist)     | List currently installed add-ons for site |

### [api](/docs/commands/api.md)

Run any Netlify API method

### [build](/docs/commands/build.md)

(Beta) Build on your local machine

### [deploy](/docs/commands/deploy.md)

Create a new deploy from the contents of a folder

### [dev](/docs/commands/dev.md)

Local dev server

| Subcommand                                  | description  |
| :------------------------------------------ | :----------- |
| [`dev:exec`](/docs/commands/dev.md#devexec) | Exec command |

### [functions](/docs/commands/functions.md)

Manage netlify functions

| Subcommand                                                        | description                                                                                                                                |
| :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| [`functions:build`](/docs/commands/functions.md#functionsbuild)   | Build functions locally                                                                                                                    |
| [`functions:create`](/docs/commands/functions.md#functionscreate) | Create a new function locally                                                                                                              |
| [`functions:invoke`](/docs/commands/functions.md#functionsinvoke) | Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions |

### [init](/docs/commands/init.md)

Configure continuous deployment for a new or existing site

### [link](/docs/commands/link.md)

Link a local repo or project folder to an existing site on Netlify

### [login](/docs/commands/login.md)

Login to your Netlify account

### [open](/docs/commands/open.md)

Open settings for the site linked to the current folder

| Subcommand                                       | description                            |
| :----------------------------------------------- | :------------------------------------- |
| [`open:admin`](/docs/commands/open.md#openadmin) | Opens current site admin UI in Netlify |
| [`open:site`](/docs/commands/open.md#opensite)   | Opens current site url in browser      |

### [sites](/docs/commands/sites.md)

Handle various site operations

| Subcommand                                            | description                       |
| :---------------------------------------------------- | :-------------------------------- |
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create an empty site (advanced)   |
| [`sites:delete`](/docs/commands/sites.md#sitesdelete) | Delete a site                     |
| [`sites:list`](/docs/commands/sites.md#siteslist)     | List all sites you have access to |

### [status](/docs/commands/status.md)

Print status information

| Subcommand                                             | description                               |
| :----------------------------------------------------- | :---------------------------------------- |
| [`status:hooks`](/docs/commands/status.md#statushooks) | Print hook information of the linked site |

### [switch](/docs/commands/switch.md)

Switch your active Netlify account

### [unlink](/docs/commands/unlink.md)

Unlink a local folder from a Netlify site

### [watch](/docs/commands/watch.md)

Watch for site deploy to finish

<!-- AUTO-GENERATED-CONTENT:END -->
