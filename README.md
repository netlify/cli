# netlify-cli
[![npm version][2]][3] [![build status][4]][5] [![windows build status][6]][7]
[![coverage][12]][13] [![dependencies][14]][15] [![downloads][8]][9]

Welcome to the Netlify CLI!

<!-- AUTO-GENERATED-CONTENT:START (TOC) -->
- [Usage](#usage)
- [Commands](#commands)
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
- [Local Development](#local-development)
<!-- AUTO-GENERATED-CONTENT:END -->

## Usage

```sh-session
netlify [command]
# shorthand
ntl [command]
```

## Commands

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_LIST) -->
### [deploy](/docs/commands/deploy.md)

Create a new deploy from the contents of a folder.

### [init](/docs/commands/init.md)

Configure continuous deployment

### [link](/docs/commands/link.md)

Link a local repo or project folder to an existing site on Netlify

### [login](/docs/commands/login.md)

Login to your Netlify account

### [logout](/docs/commands/logout.md)

Logout of your Netlify account

### [open](/docs/commands/open.md)

Opens current project urls in browser

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/docs/commands/open.md#openadmin) | Opens current site admin UI in netlify  |
| [`open:site`](/docs/commands/open.md#opensite) | Opens current site url in browser  |


### [sites](/docs/commands/sites.md)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create a new site  |
| [`sites:list`](/docs/commands/sites.md#siteslist) | List existing sites  |


### [status](/docs/commands/status.md)

Print currently logged in user

### [unlink](/docs/commands/unlink.md)

Unlink a local repo from a Netlify site

### [watch](/docs/commands/watch.md)

Watch for site deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->

# Local Development

1. Clone down the repo

```command
$ git clone git@github.com:netlify/cli.git
```

2. Install dependencies

```command
$ npm install
```

3. Run CLI locally during development

```command
$ ./bin/run [command]
```

When developing, you can use watch mode which will automatically run ava tests:

```command
$ npm run watch
```


[0]: https://img.shields.io/badge/stability-stable-green.svg
[1]: https://nodejs.org/api/documentation.html#documentation_stability_index
[2]: https://img.shields.io/npm/v/netlify-cli.svg
[3]: https://npmjs.org/package/netlify-cli
[4]: https://img.shields.io/travis/netlify/cli/master.svg
[5]: https://travis-ci.org/netlify/cli
[6]: https://ci.appveyor.com/api/projects/status/imk2qjc34ly7x11b/branch/master?svg=true
[7]: https://ci.appveyor.com/project/netlify/cli
[8]: https://img.shields.io/npm/dm/netlify-cli.svg
[9]: https://npmjs.org/package/netlify-cli
[12]: https://img.shields.io/coveralls/netlify/cli/master.svg
[13]: https://coveralls.io/github/netlify/cli
[14]: https://david-dm.org/netlify/cli/status.svg
[15]: https://david-dm.org/netlify/cli
