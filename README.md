# Netlify CLI
[![npm version][npm-img]][npm] [![build status][travis-img]][travis] [![windows build status][av-img]][av]
[![coverage][coverage-img]][coverage] [![dependencies][david-img]][david] [![downloads][dl-img]][dl]

Welcome to the Netlify CLI! The new 2.0 version was rebuilt from the ground up to help improve the site building experience.

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
- [Contributing](#contributing)
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
### [deploy](/docs/deploy.md)

Create a new deploy from the contents of a folder

### [init](/docs/init.md)

Configure continuous deployment for a new or existing site

### [link](/docs/link.md)

Link a local repo or project folder to an existing site on Netlify

### [login](/docs/login.md)

Login to your Netlify account

### [open](/docs/open.md)

Open settings for the site linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/docs/open.md#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/docs/open.md#opensite) | Opens current site url in browser  |


### [sites](/docs/sites.md)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/docs/sites.md#sitescreate) | Create an empty site (advanced)  |
| [`sites:list`](/docs/sites.md#siteslist) | List all sites you have access to  |


### [status](/docs/status.md)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/docs/status.md#statushooks) | Print hook information of the linked site  |


### [unlink](/docs/unlink.md)

Unlink a local folder from a Netlify site

### [watch](/docs/watch.md)

Watch for site deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for more info on how to make contributions to this project.

## License

MIT. See [LICENSE](LICENSE) for more details.

[npm-img]: https://img.shields.io/npm/v/netlify-cli.svg
[npm]: https://npmjs.org/package/netlify-cli
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
