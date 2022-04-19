![Netlify CLI](cli.png)

[![Coverage Status](https://codecov.io/gh/netlify/cli/branch/main/graph/badge.svg)](https://codecov.io/gh/netlify/cli)
[![npm version][npm-img]][npm] [![downloads][dl-img]][dl] [![netlify-status][netlify-img]][netlify] [![security][snyk-img]][snyk]

Interact with [Netlify](http://netlify.com/) from the comfort of your CLI.

See the [CLI command line reference](https://cli.netlify.com/commands/) to get started and the docs on using [Netlify Dev](https://github.com/netlify/cli/blob/main/docs/netlify-dev.md) to run your site locally.

## Table of Contents

<!-- AUTO-GENERATED-CONTENT:START (TOC:collapse=true&collapseText=Click to expand) -->
<details>
<summary>Click to expand</summary>

- [Installation](#installation)
- [Usage](#usage)
- [Documentation](#documentation)
- [Commands](#commands)
  - [addons](#addons)
  - [api](#api)
  - [build](#build)
  - [completion](#completion)
  - [deploy](#deploy)
  - [dev](#dev)
  - [env](#env)
  - [functions](#functions)
  - [graph](#graph)
  - [init](#init)
  - [link](#link)
  - [lm](#lm)
  - [login](#login)
  - [open](#open)
  - [recipes](#recipes)
  - [sites](#sites)
  - [status](#status)
  - [switch](#switch)
  - [unlink](#unlink)
  - [watch](#watch)
- [Contributing](#contributing)
- [Development](#development)
- [License](#license)

</details>
<!-- AUTO-GENERATED-CONTENT:END -->

## Installation

Netlify CLI requires [Node.js](https://nodejs.org) version 12 or above. To install, run the following command from any directory in your terminal:

```bash
npm install netlify-cli -g
```

When using the CLI in a CI environment we recommend installing it locally as a development dependency, instead of globally.
To install locally, run the following command from the root directory of your project:

```bash
npm install --save-dev netlify-cli
```

**Important:** Running `npm install netlify-cli -g` in CI means you're always installing the latest version of the CLI, including **breaking changes**. When you install locally and use a [lock file](https://docs.npmjs.com/cli/v7/commands/npm-ci) you guarantee reproducible builds. To manage CLI updates we recommend using an automated tool like [renovate](https://github.com/renovatebot/renovate) or [dependabot](https://dependabot.com/).

Alternatively you may also use Homebrew: `brew install netlify-cli` (thanks [@cglong](https://github.com/netlify/cli/issues/291)).

## Usage

Installing the CLI globally provides access to the `netlify` command.

```sh-session
netlify [command]

# Run `help` for detailed information about CLI commands
netlify [command] help
```

## Documentation

To learn how to log in to Netlify and start deploying sites, visit the [documentation on Netlify](https://www.netlify.com/docs/cli).

For a full command reference, see the list below, or visit [cli.netlify.com](https://cli.netlify.com/).

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for more info on how to make contributions to this project.

## Development

You'll need to follow these steps to run Netlify CLI locally:

    uninstall any globally installed versions of netlify-cli
    clone and install deps for https://github.com/netlify/cli
    npm link from inside the cli folder

Now you're both ready to start testing and to contribute to the project!

## License

MIT. See [LICENSE](LICENSE) for more details.

[npm-img]: https://img.shields.io/npm/v/netlify-cli.svg
[npm]: https://npmjs.org/package/netlify-cli
[av-img]: https://ci.appveyor.com/api/projects/status/imk2qjc34ly7x11b/branch/master?svg=true
[av]: https://ci.appveyor.com/project/netlify/cli
[dl-img]: https://img.shields.io/npm/dm/netlify-cli.svg
[dl]: https://npmjs.org/package/netlify-cli
[david-img]: https://david-dm.org/netlify/cli/status.svg
[david]: https://david-dm.org/netlify/cli
[snyk-img]: https://snyk.io/test/npm/netlify-cli/badge.svg
[snyk]: https://snyk.io/test/npm/netlify-cli
[netlify-img]: https://api.netlify.com/api/v1/badges/d3807379-2dcf-4a43-9c00-e7e8d90ecf70/deploy-status
[netlify]: https://app.netlify.com/sites/cli/deploys
