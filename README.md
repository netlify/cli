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
### [deploy](/commands/deploy)

Create a new deploy from the contents of a folder.

### [init](/commands/init)

Configure continuous deployment

### [link](/commands/link)

Link a local repo or project folder to an existing site on Netlify

### [login](/commands/login)

Login to your Netlify account

### [logout](/commands/logout)

Logout of your Netlify account

### [open](/commands/open)

Opens current project urls in browser

| Subcommand | description  |
|:--------------------------- |:-----|
| open:admin | Opens current site admin UI in netlify  |
| open:site | Opens current site url in browser  |


### [sites](/commands/sites)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| sites:create | Create a new site  |
| sites:list | List existing sites  |


### [status](/commands/status)

Print currently logged in user

### [unlink](/commands/unlink)

Unlink a local repo from a Netlify site

### [watch](/commands/watch)

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

When developing, you can use watch mode which will automatically rebuild the cli and run tests with ava:

```command
$ npm run watch
```


[0]: https://img.shields.io/badge/stability-stable-green.svg
[1]: https://nodejs.org/api/documentation.html#documentation_stability_index
[2]: https://img.shields.io/npm/v/netlify-cli.svg
[3]: https://npmjs.org/package/netlify-cli
[4]: https://img.shields.io/travis/netlify/netlify-cli/master.svg
[5]: https://travis-ci.org/netlify/netlify-cli
[6]: https://ci.appveyor.com/api/projects/status/0vh59qjo64j7j8st?svg=true
[7]: https://ci.appveyor.com/project/bcomnes/netlify-cli
[8]: https://img.shields.io/npm/dm/netlify-cli.svg
[9]: https://npmjs.org/package/netlify-cli
[12]: https://img.shields.io/coveralls/netlify/netlify-cli/master.svg
[13]: https://coveralls.io/github/netlify/netlify-cli
[14]: https://david-dm.org/netlify/netlify-cli/status.svg
[15]: https://david-dm.org/netlify/netlify-cli
