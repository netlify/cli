const Help = require('@oclif/plugin-help').default

const isBetaPlugin = (id) => id === 'completion'

const isHelpCommand = (id) => id === 'help'

const formatDescription = (description, id) => {
  if (isBetaPlugin(id)) {
    return `(Beta) ${description}`
  }

  if (isHelpCommand(id)) {
    return 'Display help. To display help for a specific command run `netlify help [command]`'
  }

  return description
}

module.exports = class CustomHelp extends Help {
  constructor(config, opts = {}) {
    config.commands.forEach((command) => {
      command.description = formatDescription(command.description, command.id)
    })
    super(config, opts)
  }
}
