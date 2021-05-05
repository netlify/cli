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
  showCommandHelp(command, topics) {
    command.description = formatDescription(command.description, command.id)
    return super.showCommandHelp(command, topics)
  }

  topics(topics) {
    return super.topics(
      topics.map((topic) => ({ ...topic, description: formatDescription(topic.description, topic.name) })),
    )
  }
}
