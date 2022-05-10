---
title: Netlify CLI Command List
description: All Netlify CLI commands
---

# Netlify CLI Command List

Welcome to the Netlify CLI! This site provides online access to all help strings in the Netlify CLI. For a more in-depth guide, please see our [Getting Started](https://www.netlify.com/docs/cli/) guide on our main docs site.

If you have questions, ideas, or would like to contribute, check out the [repository on GitHub](https://github.com/netlify/cli/).

**Before you begin**
Make sure you have [Node.js](https://nodejs.org/en/download/) version 12.20.0, 14.14.0, 16.0.0, or later.

**Install the CLI**

To install the CLI, pop open your terminal and install with `npm`.

```bash
npm install netlify-cli -g
```

**Important:** When using the CLI in a CI environment we recommend installing it locally. See more [here](https://github.com/netlify/cli#installation).

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
### [addons](/docs/commands/addons.md)

(Beta) Manage Netlify Add-ons

| Subcommand | description  |
|:--------------------------- |:-----|
| [`addons:auth`](/docs/commands/addons.md#addonsauth) | Login to add-on provider  |
| [`addons:config`](/docs/commands/addons.md#addonsconfig) | Configure add-on settings  |
| [`addons:create`](/docs/commands/addons.md#addonscreate) | Add an add-on extension to your site  |
| [`addons:delete`](/docs/commands/addons.md#addonsdelete) | Remove an add-on extension to your site  |
| [`addons:list`](/docs/commands/addons.md#addonslist) | List currently installed add-ons for site  |


### [api](/docs/commands/api.md)

Run any Netlify API method

### [build](/docs/commands/build.md)

(Beta) Build on your local machine

### [completion](/docs/commands/completion.md)

(Beta) Generate shell completion script

| Subcommand | description  |
|:--------------------------- |:-----|
| [`completion:install`](/docs/commands/completion.md#completioninstall) | Generates completion script for your preferred shell  |


### [deploy](/docs/commands/deploy.md)

Create a new deploy from the contents of a folder

### [dev](/docs/commands/dev.md)

Local dev server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/docs/commands/dev.md#devexec) | Exec command  |


### [env](/docs/commands/env.md)

(Beta) Control environment variables for the current site

| Subcommand | description  |
|:--------------------------- |:-----|
| [`env:get`](/docs/commands/env.md#envget) | Get resolved value of specified environment variable (includes netlify.toml)  |
| [`env:import`](/docs/commands/env.md#envimport) | Import and set environment variables from .env file  |
| [`env:list`](/docs/commands/env.md#envlist) | Lists resolved environment variables for site (includes netlify.toml)  |
| [`env:migrate`](/docs/commands/env.md#envmigrate) | Migrate environment variables from one site to another  |
| [`env:set`](/docs/commands/env.md#envset) | Set value of environment variable  |
| [`env:unset`](/docs/commands/env.md#envunset) | Unset an environment variable which removes it from the UI  |


### [functions](/docs/commands/functions.md)

Manage netlify functions

| Subcommand | description  |
|:--------------------------- |:-----|
| [`functions:build`](/docs/commands/functions.md#functionsbuild) | Build functions locally  |
| [`functions:create`](/docs/commands/functions.md#functionscreate) | Create a new function locally  |
| [`functions:invoke`](/docs/commands/functions.md#functionsinvoke) | Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions  |
| [`functions:list`](/docs/commands/functions.md#functionslist) | List functions that exist locally  |
| [`functions:serve`](/docs/commands/functions.md#functionsserve) | (Beta) Serve functions locally  |


### [graph](/docs/commands/graph.md)

(Beta) Control the Netlify Graph functions for the current site

| Subcommand | description  |
|:--------------------------- |:-----|
| [`graph:config:write`](/docs/commands/graph.md#graphconfigwrite) | Write a .graphqlrc.json file to the current directory for use with local tooling (e.g. the graphql extension for vscode)  |
| [`graph:edit`](/docs/commands/graph.md#graphedit) | Launch the browser to edit your local graph functions from Netlify  |
| [`graph:handler`](/docs/commands/graph.md#graphhandler) | Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.  |
| [`graph:library`](/docs/commands/graph.md#graphlibrary) | Generate the Graph function library  |
| [`graph:operations`](/docs/commands/graph.md#graphoperations) | List all of the locally available operations  |
| [`graph:pull`](/docs/commands/graph.md#graphpull) | Pull down your local Netlify Graph schema, and process pending Graph edit events  |


### [init](/docs/commands/init.md)

Configure continuous deployment for a new or existing site. To create a new site without continuous deployment, use `netlify sites:create`

### [link](/docs/commands/link.md)

Link a local repo or project folder to an existing site on Netlify

### [lm](/docs/commands/lm.md)

Handle Netlify Large Media operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`lm:info`](/docs/commands/lm.md#lminfo) | Show large media requirements information.  |
| [`lm:install`](/docs/commands/lm.md#lminstall) | Configures your computer to use Netlify Large Media  |
| [`lm:setup`](/docs/commands/lm.md#lmsetup) | Configures your site to use Netlify Large Media  |


### [login](/docs/commands/login.md)

Login to your Netlify account

### [open](/docs/commands/open.md)

Open settings for the site linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/docs/commands/open.md#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/docs/commands/open.md#opensite) | Opens current site url in browser  |


### [recipes](/docs/commands/recipes.md)

(Beta) Create and modify files in a project using pre-defined recipes

| Subcommand | description  |
|:--------------------------- |:-----|
| [`recipes:list`](/docs/commands/recipes.md#recipeslist) | (Beta) List the recipes available to create and modify files in a project  |


### [sites](/docs/commands/sites.md)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create an empty site (advanced)  |
| [`sites:create-template`](/docs/commands/sites.md#sitescreate-template) | (Beta) Create a site from a starter template  |
| [`sites:delete`](/docs/commands/sites.md#sitesdelete) | Delete a site  |
| [`sites:list`](/docs/commands/sites.md#siteslist) | List all sites you have access to  |


### [status](/docs/commands/status.md)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/docs/commands/status.md#statushooks) | Print hook information of the linked site  |


### [switch](/docs/commands/switch.md)

Switch your active Netlify account

### [unlink](/docs/commands/unlink.md)

Unlink a local folder from a Netlify site

### [watch](/docs/commands/watch.md)

Watch for site deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->
