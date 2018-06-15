Netlify-cli
===========

## Netlify CLI

Commands!

Sub Commands! `commands:subCmd`

Ability to install plugins https://github.com/oclif/plugin-plugins#what-is-this (re: third party integrations)

"Did you mean X"?

Programatic access

Hooks!

Docs gen

```
ntl command
netlify command
```

<!-- toc -->
# Usage
<!-- usage -->
# Commands
<!-- commands -->


# Go CLI commands

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

# Node CLI Commands

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

# Misc examples
https://github.com/feinoujc/gh-search-cli/blob/master/src/commands/code.ts#L16-L53
https://github.com/oclif/plugin-plugins#what-is-this
