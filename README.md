# netlify-cli [beta]
[![npm version][npm-img]][npm] [![build status][travis-img]][travis] [![windows build status][av-img]][av]
[![coverage][coverage-img]][coverage] [![dependencies][david-img]][david] [![downloads][dl-img]][dl]

Welcome to the Netlify CLI! The new 2.0 version (now in beta) was rebuilt from the ground up to help improve the site building experience.

## Table of Contents

<!-- AUTO-GENERATED-CONTENT:START (TOC:collapse=true&collapseText=Click to expand) -->
<details>
<summary>Click to expand</summary>

- [Installation](#installation)
- [Usage](#usage)
  * [CI and Environment Variables.](#ci-and-environment-variables)
- [Getting Started + Docs](#getting-started--docs)
- [Full Command Reference](#full-command-reference)
  * [deploy](#deploy)
  * [init](#init)
  * [link](#link)
  * [login](#login)
  * [logout](#logout)
  * [open](#open)
  * [sites](#sites)
  * [status](#status)
  * [unlink](#unlink)
  * [watch](#watch)
  * [telemetry](#telemetry)
- [Contributing](#contributing)
- [License](#license)

</details>
<!-- AUTO-GENERATED-CONTENT:END -->

## Installation

**Prerequisites**

- [Node.js](https://nodejs.org/en/download/) 8+.
- [Netlify User Account](http://app.netlify.com/)

To install the Netlify CLI, run the following command in your terminal:

```sh-session
npm install netlify-cli@next -g
```

## Usage

After installing the CLI globally, connect the CLI to your Netlify account with the following command:

```sh-session
netlify login
```

This will open a browser window, asking you to log in with Netlify and grant access to **Netlify CLI**. This will store your Netlify access token in your home folder, under `~/.netlify/config.json`.

```sh-session
netlify [command]

# Run `help` for detailed information about CLI commands
netlify [command] help
```

### CI and Environment Variables.

The following environment variables can be used to override configuration file lookups and prompts:

- `NETLIFY_AUTH_TOKEN` - an access token to use when authenticating commands. **KEEP THIS VALUE PRIVATE**
- `NETLIFY_SITE_ID` - force the cli to think the cwd is linked to this site id. This can be made public.

## Getting Started + Docs

Please see the getting started guide on our docs website:

- [netlify.com/docs/cli](https://www.netlify.com/docs/cli)

<!-- TODO: Grab a screenshot to make it pop more -->

## Full Command Reference

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_LIST) -->
### [deploy](/docs/commands/deploy.md)

Create a new deploy from the contents of a folder

### [init](/docs/commands/init.md)

Configure continuous deployment for a new or existing site

### [link](/docs/commands/link.md)

Link a local repo or project folder to an existing site on Netlify

### [login](/docs/commands/login.md)

Login to your Netlify account

### [logout](/docs/commands/logout.md)

Logout of your Netlify account

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
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create an empty site (advanced)

Create a blank site that isn't associated with any git remote.  Does not link to the current working directory.
  |
| [`sites:list`](/docs/commands/sites.md#siteslist) | List all sites you have access too  |


### [status](/docs/commands/status.md)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/docs/commands/status.md#statushooks) | Print hook information of the linked site  |


### [unlink](/docs/commands/unlink.md)

Unlink a local folder from a Netlify site

### [watch](/docs/commands/watch.md)

Watch for site deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->

### telemetry

By default, the CLI collects usage stats from logged in Netlify users. This is to constantly improve the developer experience of the tool and bake in better features.

If you'd like to opt out of sending telemetry data, you can do so with the `--telemetry-disable` flag

```sh-session
# opt out of telemetry
netlify --telemetry-disable

# turn on telemetry
netlify --telemetry-enable
```

Or edit the `telemetryDisabled` property of the `~/.netlify/config.json` file in your computers root directory.

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
