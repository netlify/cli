const { Command, flags } = require('@oclif/command')

class FunctionsBuildCommand extends Command {
  async run() {
    this.log(`build a function locally`)
  }
}

FunctionsBuildCommand.description = `build functions locally
`

FunctionsBuildCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

// TODO make visible once implementation complete
FunctionsBuildCommand.hidden = true

module.exports = FunctionsBuildCommand
