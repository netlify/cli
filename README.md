# netlify-cli [![stability][0]][1]
[![npm version][2]][3] [![build status][4]][5] [![windows build status][6]][7]
[![coverage][12]][13] [![downloads][8]][9]

Pluggable CLI for Netlify. 🎉

<!-- toc -->
* [Usage](#usage)
* [Command Topics](#command-topics)
* [Local Development](#local-development)
<!-- tocstop -->

# Usage
<!-- usage -->
```sh-session
$ npm install -g netlify-cli
$ netlify-cli COMMAND
running command...
$ netlify-cli (-v|--version|version)
netlify-cli/2.0.0-alpha.4 darwin-x64 node-v10.8.0
$ netlify-cli --help [COMMAND]
USAGE
  $ netlify-cli COMMAND
...
```
<!-- usagestop -->

You can also access the cli from the following aliases:

- `netlify`
- `ntl`

<!-- commands -->
# Command Topics

* [`netlify-cli addons`](docs/addons.md) - Handle addon operations
* [`netlify-cli deploy`](docs/deploy.md) - Create a new deploy from the contents of a folder.
* [`netlify-cli init`](docs/init.md) - Configure continuous deployment
* [`netlify-cli link`](docs/link.md) - Link a local repo or project folder to an existing site on Netlify
* [`netlify-cli login`](docs/login.md) - Login to account
* [`netlify-cli logout`](docs/logout.md) - Logout of account
* [`netlify-cli sites`](docs/sites.md) - Handle site operations
* [`netlify-cli status`](docs/status.md) - Print currently logged in use
* [`netlify-cli unlink`](docs/unlink.md) - Unlink a local repo from a Netlify site

<!-- commandsstop -->

---
<details>
  <summary>Notes from previous CLIs</summary>

This CLI supercedes our [old Go CLI](https://github.com/netlify/netlifyctl) and [old Node CLI](https://github.com/netlify/netlify-cli).

**Go CLI commands**

via https://github.com/netlify/netlifyctl

```
Available Commands:
  assets    # List assets attached to a site
  ├── add   # Add an asset to a site
  └── info  # Show information for an asset or a group of them
  deploy    # Deploy your site
  form      # List forms
  └── submissions # list form submissions
  help      # Help about any command
  init      # Configure continuous deployment
  login     # Log user in
  site      # Handle site operations
  ├── create   # create site
  └── update   # Update site settings
  version
```

**Node CLI Commands**

via https://github.com/netlify/netlify-cli

```
createSite = require("../lib/commands/create_site"),
deleteSite = require("../lib/commands/delete_site"),
deploy     = require("../lib/commands/deploy"),
publish    = require("../lib/commands/publish"),
init       = require("../lib/commands/init"),
list       = require("../lib/commands/list_sites"),
updateSite = require("../lib/commands/update_site"),
openSite   = require("../lib/commands/open"),
env        = require("../lib/commands/env"),
```

</details>


**Misc examples**

- https://github.com/feinoujc/gh-search-cli/blob/master/src/commands/code.ts#L16-L53
- https://github.com/oclif/plugin-plugins#what-is-this

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
[8]: http://img.shields.io/npm/dm/netlify-cli.svg
[9]: https://npmjs.org/package/netlify-cli
[12]: https://img.shields.io/coveralls/netlify/netlify-cli/master.svg
[13]: https://coveralls.io/github/netlify/netlify-cli
