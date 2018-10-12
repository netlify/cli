# @netlify/cli-base

[netlify-cli](https://github.com/netlify/cli)'s [@oclif/command](@oclif/command) baseclass.

Provides a unified way to load and persist global and site level cli config and authenticated api.
Also allows commands to program against a consistent base-class api to enable changes down the road.

## Usage

```js
const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const showHelp = require('../../utils/showHelp')
const { isEmptyCommand } = require('../../utils/checkCommandInputs')

class OpenCommand extends Command {
  async run() {
    const { flags, args } = this.parse(OpenCommand)
    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
    }
    // Default open Netlify admin
    await OpenAdminCommand.run()
  }
}

OpenCommand.description = `${renderShortDesc('Opens current project urls in browser')}`

OpenCommand.examples = [
  'netlify open:admin',
  'netlify open:site'
]

OpenCommand.hidden = true

module.exports = OpenCommand

```

## API

Import the the base class and extend it, the same way you do with `@oclif/command`.

Commands that extend this base class get access to the [same api](https://oclif.io/docs/commands.html) as `@oclif/command` plus a few extra properties:


### `this.netlify.globalConfig`

Provides access to configuration stored in the users home folder under `~/.netlify`.  
See [global-config](global-config/README.md).

### `this.netlify.state`

Provides access to site-level state relative to the `process.cwd`. (e.g. `project/.netlify/config.json`)
See [site-config](global-config/README.md)

### `this.netlify.api`

An instance of the [`netlify`](https://github.com/netlify/js-client) api client.  If access tokens are found in global config, then this client will automatically be authenticated.

### `this.netlify.site`

Provides read access to `project/netlify.toml` config.

#### `this.authenticate()`

A method that will log the user in if they are not already logged in.  If the user is already logged in, this is a noop.
