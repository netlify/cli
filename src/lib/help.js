const Help = require('@oclif/plugin-help').default

const isBetaPlugin = (id) => id === 'completion'

const formatDescription = (description, id) => (isBetaPlugin(id) ? `(Beta) ${description}` : description)

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
