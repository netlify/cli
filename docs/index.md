---
title: Netlify CLI command reference
description: All Netlify CLI commands
---

# Netlify CLI command reference

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

Run any Netlify API method

### [blobs](/commands/blobs)

Manage objects in Netlify Blobs

| Subcommand | description  |
|:--------------------------- |:-----|
| [`blobs:delete`](/commands/blobs#blobsdelete) | Deletes an object with a given key, if it exists, from a Netlify Blobs store  |
| [`blobs:get`](/commands/blobs#blobsget) | Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file  |
| [`blobs:list`](/commands/blobs#blobslist) | Lists objects in a Netlify Blobs store  |
| [`blobs:set`](/commands/blobs#blobsset) | Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter  |


### [build](/commands/build)

Build on your local machine

### [completion](/commands/completion)

Generate shell completion script

| Subcommand | description  |
|:--------------------------- |:-----|
| [`completion:install`](/commands/completion#completioninstall) | Generates completion script for your preferred shell  |


### [deploy](/commands/deploy)

Create a new deploy from the contents of a folder

### [dev](/commands/dev)

Local dev server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/commands/dev#devexec) | Exec command  |


### [env](/commands/env)

Control environment variables for the current site

| Subcommand | description  |
|:--------------------------- |:-----|
| [`env:clone`](/commands/env#envclone) | Clone environment variables from one site to another  |
| [`env:get`](/commands/env#envget) | Get resolved value of specified environment variable (includes netlify.toml)  |
| [`env:import`](/commands/env#envimport) | Import and set environment variables from .env file  |
| [`env:list`](/commands/env#envlist) | Lists resolved environment variables for site (includes netlify.toml)  |
| [`env:set`](/commands/env#envset) | Set value of environment variable  |
| [`env:unset`](/commands/env#envunset) | Unset an environment variable which removes it from the UI  |


### [functions](/commands/functions)

Manage netlify functions

| Subcommand | description  |
|:--------------------------- |:-----|
| [`functions:build`](/commands/functions#functionsbuild) | Build functions locally  |
| [`functions:create`](/commands/functions#functionscreate) | Create a new function locally  |
| [`functions:invoke`](/commands/functions#functionsinvoke) | Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions  |
| [`functions:list`](/commands/functions#functionslist) | List functions that exist locally  |
| [`functions:serve`](/commands/functions#functionsserve) | Serve functions locally  |


### [init](/commands/init)

Configure continuous deployment for a new or existing site. To create a new site without continuous deployment, use `netlify sites:create`

### [integration](/commands/integration)

Manage Netlify Integrations built with the Netlify SDK

| Subcommand | description  |
|:--------------------------- |:-----|
| [`integration:deploy`](/commands/integration#integrationdeploy) | Register, build, and deploy a private integration on Netlify  |


### [link](/commands/link)

Link a local repo or project folder to an existing site on Netlify

### [login](/commands/login)

Login to your Netlify account

### [logs](/commands/logs)

Stream logs from your site

| Subcommand | description  |
|:--------------------------- |:-----|
| [`logs:deploy`](/commands/logs#logsdeploy) | (Beta) Stream the logs of deploys currently being built to the console  |
| [`logs:function`](/commands/logs#logsfunction) | (Beta) Stream netlify function logs to the console  |


### [open](/commands/open)

Open settings for the site linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/commands/open#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/commands/open#opensite) | Opens current site url in browser  |


### [recipes](/commands/recipes)

Create and modify files in a project using pre-defined recipes

| Subcommand | description  |
|:--------------------------- |:-----|
| [`recipes:list`](/commands/recipes#recipeslist) | List the recipes available to create and modify files in a project  |


### [serve](/commands/serve)

Build the site for production and serve locally. This does not watch the code for changes, so if you need to rebuild your site then you must exit and run `serve` again.

### [sites](/commands/sites)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/commands/sites#sitescreate) | Create an empty site (advanced)  |
| [`sites:create-template`](/commands/sites#sitescreate-template) | (Beta) Create a site from a starter template  |
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
