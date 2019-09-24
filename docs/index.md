---
title: Netlify CLI Command List
description: All Netlify CLI commands
---

# Netlify CLI Command List

Welcome to the Netlify CLI! This site provides online access to all help strings in the Netlify CLI. For a more in-depth guide, please see our [Getting Started](https://www.netlify.com/docs/cli/) guide on our main docs site.

If you have questions, ideas, or would like to contribute, check out the [repository on Github](https://github.com/netlify/cli/).

**Install the CLI**

To install the CLI, pop open your terminal and install with `npm`.

```bash
npm install netlify-cli -g
```

**Listing commands**

To get a list of commands, run:

```
netlify help
```

To get a list of available sub-commands, arguments, and flags, run:

```
netlify [command] help
```

## Commands

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_LIST) -->

### [addons](/commands/addons)

(Beta) Manage Netlify Add-ons

| Subcommand                                       | description                               |
| :----------------------------------------------- | :---------------------------------------- |
| [`addons:auth`](/commands/addons#addonsauth)     | Login to add-on provider                  |
| [`addons:config`](/commands/addons#addonsconfig) | Configure add-on settings                 |
| [`addons:create`](/commands/addons#addonscreate) | Add an add-on extension to your site      |
| [`addons:delete`](/commands/addons#addonsdelete) | Remove an add-on extension to your site   |
| [`addons:list`](/commands/addons#addonslist)     | List currently installed add-ons for site |

### [api](/commands/api)

Run any Netlify API method

### [deploy](/commands/deploy)

Create a new deploy from the contents of a folder

### [dev](/commands/dev)

Local dev server

| Subcommand                          | description  |
| :---------------------------------- | :----------- |
| [`dev:exec`](/commands/dev#devexec) | Exec command |

### [functions](/commands/functions)

Manage netlify functions

| Subcommand                                                | description                                                                                                                                |
| :-------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| [`functions:build`](/commands/functions#functionsbuild)   | build functions locally                                                                                                                    |
| [`functions:create`](/commands/functions#functionscreate) | create a new function locally                                                                                                              |
| [`functions:invoke`](/commands/functions#functionsinvoke) | trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions |

### [init](/commands/init)

Configure continuous deployment for a new or existing site

### [link](/commands/link)

Link a local repo or project folder to an existing site on Netlify

### [login](/commands/login)

Login to your Netlify account

### [open](/commands/open)

Open settings for the site linked to the current folder

| Subcommand                               | description                            |
| :--------------------------------------- | :------------------------------------- |
| [`open:admin`](/commands/open#openadmin) | Opens current site admin UI in Netlify |
| [`open:site`](/commands/open#opensite)   | Opens current site url in browser      |

### [sites](/commands/sites)

Handle various site operations

| Subcommand                                    | description                       |
| :-------------------------------------------- | :-------------------------------- |
| [`sites:create`](/commands/sites#sitescreate) | Create an empty site (advanced)   |
| [`sites:delete`](/commands/sites#sitesdelete) | Delete a site                     |
| [`sites:list`](/commands/sites#siteslist)     | List all sites you have access to |

### [status](/commands/status)

Print status information

| Subcommand                                     | description                               |
| :--------------------------------------------- | :---------------------------------------- |
| [`status:hooks`](/commands/status#statushooks) | Print hook information of the linked site |

### [switch](/commands/switch)

Switch your active Netlify account

### [unlink](/commands/unlink)

Unlink a local folder from a Netlify site

### [watch](/commands/watch)

Watch for site deploy to finish

<!-- AUTO-GENERATED-CONTENT:END -->
