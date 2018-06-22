Netlify-cli
===========

Pluggable CLI for Netlify. 🎉

<!-- toc -->
* [Local Development](#local-development)
* [Commands](#commands)
* [Command Topics](#command-topics)
<!-- tocstop -->

# Local Development

1. Clone down the repo

    ```bash
    git clone git@github.com:DavidWells/cli.git
    ```

2. Install dependencies

    ```bash
    npm install
    ```

3. Run CLI locally during development

    ```bash
    ./bin/run [command]
    ```

<!-- # Usage
usaxge  
```sh-session
$ npm install -g netlify-cli
$ netlify-cli COMMAND
running command...
$ netlify-cli (-v|--version|version)
netlify-cli/0.0.0 darwin-x64 node-v9.2.0
$ netlify-cli --help [COMMAND]
USAGE
  $ netlify-cli COMMAND
...
```
<!-- usagxestop -->

# Commands
<!-- commands -->
# Command Topics

* [`netlify-cli forms`](docs/forms.md) - Handle form operations
* [`netlify-cli functions`](docs/functions.md) - Manage netlify functions
* [`netlify-cli init`](docs/init.md) - Configure continuous deployment in current working directory
* [`netlify-cli login`](docs/login.md) - Login to account
* [`netlify-cli logout`](docs/logout.md) - Logout of account
* [`netlify-cli sites`](docs/sites.md) - Handle site operations

<!-- commandsstop -->

---

**Notes from previous CLIs**

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

**Misc examples**

- https://github.com/feinoujc/gh-search-cli/blob/master/src/commands/code.ts#L16-L53
- https://github.com/oclif/plugin-plugins#what-is-this
