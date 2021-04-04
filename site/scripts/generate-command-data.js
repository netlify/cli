const path = require('path')

const filterObj = require('filter-obj')
const mapObj = require('map-obj')
const { globby } = require('markdown-magic')

const getFlagType = (flagData) => {
  if (flagData.type === 'option') {
    return flagData.options ? flagData.options.join(' | ') : 'string'
  }

  return flagData.type
}

const formatExamples = (examples) =>
  Array.isArray(examples) ? examples.map((example) => example.replace('<%= config.bin %>', 'netlify')) : examples

const isBetaPlugin = (description) => description.includes('Generate shell completion script')

const formatDescription = (description) => (isBetaPlugin(description) ? `(Beta) ${description}` : description)

module.exports = function generateCommandData() {
  const commandsPath = path.join(__dirname, '..', '..', 'src/commands')
  const completionPluginPath = path.join(__dirname, '..', '..', 'node_modules/oclif-plugin-completion/lib/commands')
  // console.log('commandsPath', commandsPath)
  const commands = globby.sync([`${commandsPath}/**/**.js`, `${completionPluginPath}/**/**.js`])

  const allCommands = commands.map((file) => {
    // eslint-disable-next-line node/global-require, import/no-dynamic-require
    let data = require(file)
    if (!data.description && data.default && data.default.description) {
      data = data.default
    }
    const command = commandFromPath(file)
    const [parentCommand] = command.split(':')
    const parent = command === parentCommand
    // remove hidden flags
    const flags =
      data.flags &&
      mapObj(
        filterObj(data.flags, (_, value) => value.hidden !== true),
        (flag, flagData) => [flag, { ...flagData, type: getFlagType(flagData) }],
      )
    return {
      command,
      commandGroup: parentCommand,
      isParent: parent,
      path: file,
      data: { ...data, flags },
    }
  })

  const visibleCommands = allCommands.filter((cmd) => !cmd.data.hidden)

  const groupedCommands = visibleCommands.reduce((acc, curr) => {
    if (curr.commandGroup === curr.command) {
      acc[curr.commandGroup] = {
        name: curr.command,
        usage: curr.data.usage,
        description: formatDescription(curr.data.description),
        flags: curr.data.flags,
        args: curr.data.args,
        examples: formatExamples(curr.data.examples),
        strict: curr.data.strict,
        commands: [],
      }
    }
    return acc
  }, {})

  const groupedCommandsWithData = visibleCommands.reduce((acc, curr) => {
    if (curr.commandGroup !== curr.command && acc[curr.commandGroup] && acc[curr.commandGroup].commands) {
      acc[curr.commandGroup].commands = [
        ...acc[curr.commandGroup].commands,
        {
          name: curr.command,
          usage: curr.data.usage,
          description: formatDescription(curr.data.description),
          flags: curr.data.flags,
          args: curr.data.args,
          examples: formatExamples(curr.data.examples),
          strict: curr.data.strict,
        },
      ]
    }
    return acc
  }, groupedCommands)

  return groupedCommandsWithData
}

const commandFromPath = function (filePath) {
  let normalized = path.normalize(filePath)

  // console.log('commandFromPath', normalized)
  // console.log('process.cwd()', process.cwd())
  const rootDir = path.join(__dirname, '..', '..')
  // Replace node_modules path for CLI plugins
  if (normalized.includes('node_modules')) {
    // in: /node_modules/<package-name>/src/commands/dev/exec.js
    // out: /src/commands/dev/exec.js
    normalized = normalized.replace(/\/node_modules\/((?:[^/]+)*)?\//, '/')
  }
  return normalized
    .replace(rootDir, '')
    .replace(/\\/g, '/')
    .replace('.js', '')
    .replace(/\/(src|lib)\/commands\//, '')
    .replace('/index', '')
    .replace(/\//g, ':')
}
