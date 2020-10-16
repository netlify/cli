const { execSync } = require('child_process')

const { Command } = require('@oclif/command')
const chalk = require('chalk')

const showHelp = function (command) {
  execSync(`netlify ${command} --help`, { stdio: [0, 1, 2] })
}

const isEmptyCommand = function (flags, args) {
  if (!hasFlags(flags) && !hasArgs(args)) {
    return true
  }
  return false
}

const hasFlags = function (flags) {
  return Object.keys(flags).length
}

const hasArgs = function (args) {
  return Object.keys(args).length
}

class FunctionsCommand extends Command {
  async run() {
    const { flags, args } = this.parse(FunctionsCommand)
    // run help command if no args passed
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'functions',
      },
    })
  }
}

const name = chalk.greenBright('`functions`')
FunctionsCommand.aliases = ['function']
FunctionsCommand.description = `Manage netlify functions
The ${name} command will help you manage the functions in this site
`
FunctionsCommand.examples = [
  'netlify functions:create --name function-xyz',
  'netlify functions:build --name function-abc --timeout 30s',
]

module.exports = FunctionsCommand
