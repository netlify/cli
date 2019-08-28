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
### [api](/commands/api)

Run Netlify API Methods

### [deploy](/commands/deploy)

Create a new deploy from the contents of a folder

### [dev](/commands/dev)

Local dev server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/commands/dev#devexec) | Exec command  |


### [functions](/commands/functions)

Manage netlify functions

| Subcommand | description  |
|:--------------------------- |:-----|
| [`functions:build`](/commands/functions#functionsbuild) | build functions locally  |
| [`functions:create`](/commands/functions#functionscreate) | create a new function locally  |
| [`functions:invoke`](/commands/functions#functionsinvoke) | trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions  |


### [init](/commands/init)

Configure continuous deployment for a new or existing site

### [link](/commands/link)

Link a local repo or project folder to an existing site on Netlify

### [login](/commands/login)

Login to your Netlify account

### [open](/commands/open)

Open settings for the site linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/commands/open#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/commands/open#opensite) | Opens current site url in browser  |


### [sites](/commands/sites)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/commands/sites#sitescreate) | Create an empty site (advanced)  |
| [`sites:delete`](/commands/sites#sitesdelete) | Delete a site  |
| [`sites:list`](/commands/sites#siteslist) | List all sites you have access to  |


### [status](/commands/status)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/commands/status#statushooks) | Print hook information of the linked site  |


### [switch](/commands/switch)

Switch your active Netlify account

### [unlink](/commands/unlink)

Unlink a local folder from a Netlify site

### [watch](/commands/watch)

Watch for site deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->
