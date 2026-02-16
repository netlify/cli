---
title: Netlify CLI command reference
description: All Netlify CLI commands
---

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
### [agents](/commands/agents)

Manage Netlify AI agent tasks

| Subcommand | description  |
|:--------------------------- |:-----|
| [`agents:create`](/commands/agents#agentscreate) | Create and run a new agent task on your site  |
| [`agents:list`](/commands/agents#agentslist) | List agent tasks for the current site  |
| [`agents:show`](/commands/agents#agentsshow) | Show details of a specific agent task  |
| [`agents:stop`](/commands/agents#agentsstop) | Stop a running agent task  |


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

### [clone](/commands/clone)

Clone a remote repository and link it to an existing project on Netlify

### [completion](/commands/completion)

Generate shell completion script

| Subcommand | description  |
|:--------------------------- |:-----|
| [`completion:install`](/commands/completion#completioninstall) | Generates completion script for your preferred shell  |


### [db](/commands/db)

Provision a production ready Postgres database with a single command

| Subcommand | description  |
|:--------------------------- |:-----|
| [`init`](/commands/db#init) | Initialize a new database for the current site  |
| [`status`](/commands/db#status) | Check the status of the database  |


### [deploy](/commands/deploy)

Deploy your project to Netlify

### [dev](/commands/dev)

Local dev server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/commands/dev#devexec) | Runs a command within the netlify dev environment. For example, with environment variables from any installed add-ons  |


### [env](/commands/env)

Control environment variables for the current project

| Subcommand | description  |
|:--------------------------- |:-----|
| [`env:clone`](/commands/env#envclone) | Clone environment variables from one project to another  |
| [`env:get`](/commands/env#envget) | Get resolved value of specified environment variable (includes netlify.toml)  |
| [`env:import`](/commands/env#envimport) | Import and set environment variables from .env file  |
| [`env:list`](/commands/env#envlist) | Lists resolved environment variables for project (includes netlify.toml)  |
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

Configure continuous deployment for a new or existing project. To create a new project without continuous deployment, use `netlify sites:create`

### [link](/commands/link)

Link a local repo or project folder to an existing project on Netlify

### [login](/commands/login)

Login to your Netlify account

### [logs](/commands/logs)

Stream logs from your project

| Subcommand | description  |
|:--------------------------- |:-----|
| [`logs:deploy`](/commands/logs#logsdeploy) | Stream the logs of deploys currently being built to the console  |
| [`logs:function`](/commands/logs#logsfunction) | Stream netlify function logs to the console  |


### [open](/commands/open)

Open settings for the project linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/commands/open#openadmin) | Opens current project admin UI in Netlify  |
| [`open:site`](/commands/open#opensite) | Opens current project url in browser  |


### [push](/commands/push)

Push code to Netlify via git, triggering a build

### [recipes](/commands/recipes)

Create and modify files in a project using pre-defined recipes

| Subcommand | description  |
|:--------------------------- |:-----|
| [`recipes:list`](/commands/recipes#recipeslist) | List the recipes available to create and modify files in a project  |


### [serve](/commands/serve)

Build the project for production and serve locally. This does not watch the code for changes, so if you need to rebuild your project then you must exit and run `serve` again.

### [sites](/commands/sites)

Handle various project operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/commands/sites#sitescreate) | Create an empty project (advanced)  |
| [`sites:create-template`](/commands/sites#sitescreate-template) | (Beta) Create a project from a starter template  |
| [`sites:delete`](/commands/sites#sitesdelete) | Delete a project  |
| [`sites:list`](/commands/sites#siteslist) | List all projects you have access to  |


### [status](/commands/status)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/commands/status#statushooks) | Print hook information of the linked project  |


### [switch](/commands/switch)

Switch your active Netlify account

### [unlink](/commands/unlink)

Unlink a local folder from a Netlify project

### [watch](/commands/watch)

Watch for project deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->
