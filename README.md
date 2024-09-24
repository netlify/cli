![Netlify CLI](cli.png)

[![Coverage Status](https://codecov.io/gh/netlify/cli/branch/main/graph/badge.svg)](https://codecov.io/gh/netlify/cli)
[![npm version][npm-img]][npm] [![downloads][dl-img]][dl] [![netlify-status][netlify-img]][netlify]
[![security][snyk-img]][snyk]

Interact with [Netlify](http://netlify.com/) from the comfort of your CLI.

See the [CLI command line reference](https://cli.netlify.com/commands/) to get started and the docs on using
[Netlify Dev](https://github.com/netlify/cli/blob/main/docs/commands/dev.md) to run your site locally.

## Table of Contents

<!-- AUTO-GENERATED-CONTENT:START (TOC:collapse=true&collapseText=Click to expand) -->
<details>
<summary>Click to expand</summary>

- [Installation](#installation)
- [Usage](#usage)
- [Documentation](#documentation)
- [Commands](#commands)
  - [api](#api)
  - [blobs](#blobs)
  - [build](#build)
  - [completion](#completion)
  - [deploy](#deploy)
  - [dev](#dev)
  - [env](#env)
  - [functions](#functions)
  - [init](#init)
  - [integration](#integration)
  - [link](#link)
  - [login](#login)
  - [open](#open)
  - [recipes](#recipes)
  - [serve](#serve)
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

Netlify CLI requires [Node.js](https://nodejs.org) version 18.14.0 or above. To install, run the following command from any
directory in your terminal:

```bash
npm install netlify-cli -g
```

When using the CLI in a CI environment we recommend installing it locally as a development dependency, instead of
globally. To install locally, run the following command from the root directory of your project:

```bash
npm install --save-dev netlify-cli
```

**Important:** Running `npm install netlify-cli -g` in CI means you're always installing the latest version of the CLI,
including **breaking changes**. When you install locally and use a
[lock file](https://docs.npmjs.com/cli/v7/commands/npm-ci) you guarantee reproducible builds. To manage CLI updates we
recommend using an automated tool like [renovate](https://github.com/renovatebot/renovate) or
[dependabot](https://github.com/dependabot).

Alternatively you may also use Homebrew: `brew install netlify-cli` (thanks
[@cglong](https://github.com/netlify/cli/issues/291)).

## Usage

Installing the CLI globally provides access to the `netlify` command.

```sh-session
netlify [command]

# Run `help` for detailed information about CLI commands
netlify [command] help
```

## Documentation

To learn how to log in to Netlify and start deploying sites, visit the
[documentation on Netlify](https://docs.netlify.com/cli/get-started/).


## Commands

For a full command reference visit [cli.netlify.com](https://cli.netlify.com/).

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
