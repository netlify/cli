# Netlify CLI
[![npm version][npm-img]][npm] [![build status][azure-img]][azure] [![coverage][coverage-img]][coverage] [![dependencies][david-img]][david] [![downloads][dl-img]][dl] [![netlify-status][netlify-img]][netlify]

Welcome to the Netlify CLI! The new 2.0 version was rebuilt from the ground up to help improve the site building experience.

> ⚠️ **If you are looking for docs or to report an issue on [Netlify Dev](https://www.netlify.com/blog/2019/04/09/netlify-dev--our-entire-platform-right-on-your-laptop/), head to the [netlify-dev-plugin repo](https://github.com/netlify/netlify-dev-plugin#what-is-netlify-dev).** This is a new release, we appreciate your patience and bug reports!

## Table of Contents

<!-- AUTO-GENERATED-CONTENT:START (TOC:collapse=true&collapseText=Click to expand) -->
<details>
<summary>Click to expand</summary>

- [Installation](#installation)
- [Usage](#usage)
- [Documentation](#documentation)
- [Commands](#commands)
  * [deploy](#deploy)
  * [init](#init)
  * [link](#link)
  * [login](#login)
  * [open](#open)
  * [sites](#sites)
  * [status](#status)
  * [unlink](#unlink)
  * [watch](#watch)
  * [dev](#dev)
  * [functions](#functions)
- [Contributing](#contributing)
- [Development](#development)
- [License](#license)

</details>
<!-- AUTO-GENERATED-CONTENT:END -->

## Installation

Netlify CLI requires [Node.js](https://nodejs.org) version 8 or above. To install, run the following command from any directory in your terminal:

```bash
npm install netlify-cli -g
```

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
### [deploy](/docs/commands/deploy.md)

Create a new deploy from the contents of a folder

### [init](/docs/commands/init.md)

Configure continuous deployment for a new or existing site

### [link](/docs/commands/link.md)

Link a local repo or project folder to an existing site on Netlify

### [login](/docs/commands/login.md)

Login to your Netlify account

### [open](/docs/commands/open.md)

Open settings for the site linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/docs/commands/open.md#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/docs/commands/open.md#opensite) | Opens current site url in browser  |


### [sites](/docs/commands/sites.md)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create an empty site (advanced)  |
| [`sites:list`](/docs/commands/sites.md#siteslist) | List all sites you have access to  |


### [status](/docs/commands/status.md)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/docs/commands/status.md#statushooks) | Print hook information of the linked site  |


### [unlink](/docs/commands/unlink.md)

Unlink a local folder from a Netlify site

### [watch](/docs/commands/watch.md)

Watch for site deploy to finish

### [dev](/docs/commands/dev.md)

Local dev server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/docs/commands/dev.md#devexec) | Exec command  |


### [functions](/docs/commands/functions.md)

Manage netlify functions

| Subcommand | description  |
|:--------------------------- |:-----|
| [`functions:build`](/docs/commands/functions.md#functionsbuild) | build functions locally  |
| [`functions:create`](/docs/commands/functions.md#functionscreate) | create a new function locally  |



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
[azure-img]: https://dev.azure.com/netlify/Netlify%20CLI/_apis/build/status/netlify.cli?branchName=master
[azure]: https://dev.azure.com/netlify/Netlify%20CLI/_build?definitionId=3
[travis-img]: https://img.shields.io/travis/netlify/cli/master.svg
[travis]: https://travis-ci.org/netlify/cli
[av-img]: https://ci.appveyor.com/api/projects/status/imk2qjc34ly7x11b/branch/master?svg=true
[av]: https://ci.appveyor.com/project/netlify/cli
[dl-img]: https://img.shields.io/npm/dm/netlify-cli.svg
[dl]: https://npmjs.org/package/netlify-cli
[coverage-img]: https://img.shields.io/coveralls/netlify/cli/master.svg
[coverage]: https://coveralls.io/github/netlify/cli
[david-img]: https://david-dm.org/netlify/cli/status.svg
[david]: https://david-dm.org/netlify/cli
[netlify-img]: https://api.netlify.com/api/v1/badges/d3807379-2dcf-4a43-9c00-e7e8d90ecf70/deploy-status
[netlify]: https://app.netlify.com/sites/cli/deploys
