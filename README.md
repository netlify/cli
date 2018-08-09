Netlify-cli
===========

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
$ netlify COMMAND
running command...
$ netlify --version
1.2.3
$ netlify --help [COMMAND]
USAGE
  $ netlify COMMAND
...
```
<!-- usagestop -->

<!-- commands -->
# Command Topics

* [`netlify deploy`](docs/deploy.md) - Create a new deploy from the contents of a folder.
* [`netlify forms`](docs/forms.md) - Handle form operations
* [`netlify functions`](docs/functions.md) - Manage netlify functions
* [`netlify link`](docs/link.md) - Link a local repo or project folder to an existing site on Netlify
* [`netlify login`](docs/login.md) - Login to account
* [`netlify logout`](docs/logout.md) - Logout of account
* [`netlify sites`](docs/sites.md) - Handle site operations
* [`netlify status`](docs/status.md) - Print currently logged in use
* [`netlify whoami`](docs/whoami.md) - Print currently logged in user and account info

<!-- commandsstop -->

---
<detail>
  <summary>
    
**Notes from previous CLIs**

  </summary>

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

</detail>

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
