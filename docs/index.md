---
title: Netlify CLI Command List
description: All Netlify CLI commands
---

# Netlify CLI Command List

Welcome to the Netlify CLI!  This site provides online access to all help strings in the Netlify CLI.  For a more in-depth guide, please see our [Getting Started](https://www.netlify.com/docs/cli/) guide on our main docs site.

If you have questions, ideas, or would like to contribute, check out the [repository on Github](https://github.com/netlify/cli/).

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
### [addons](/addons)

Handle addon operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`addons:auth`](/addons#addonsauth) | Login to add-on provider  |
| [`addons:config`](/addons#addonsconfig) | Configure add-on settings  |
| [`addons:create`](/addons#addonscreate) | Add an add-on extension to your site  |
| [`addons:delete`](/addons#addonsdelete) | Remove an add-on extension to your site  |
| [`addons:list`](/addons#addonslist) | list current site add-ons  |


### [deploy](/deploy)

Create a new deploy from the contents of a folder

### [init](/init)

Configure continuous deployment for a new or existing site

### [link](/link)

Link a local repo or project folder to an existing site on Netlify

### [login](/login)

Login to your Netlify account

### [open](/open)

Open settings for the site linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/open#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/open#opensite) | Opens current site url in browser  |


### [sites](/sites)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/sites#sitescreate) | Create an empty site (advanced)  |
| [`sites:list`](/sites#siteslist) | List all sites you have access to  |


### [status](/status)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/status#statushooks) | Print hook information of the linked site  |


### [unlink](/unlink)

Unlink a local folder from a Netlify site

### [watch](/watch)

Watch for site deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->
