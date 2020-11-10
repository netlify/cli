const path = require('path')

const filterObj = require('filter-obj')
const mapObj = require('map-obj')
const { globby } = require('markdown-magic')

module.exports = function generateCommandData() {
  const commandsPath = path.join(__dirname, '..', '..', 'src/commands')
  const netlifyDevPath = path.join(__dirname, '..', '..', 'node_modules/netlify-dev-plugin/src/commands')
  // console.log('commandsPath', commandsPath)
  const commands = globby.sync([`${commandsPath}/**/**.js`, `${netlifyDevPath}/**/**.js`])

  const allCommands = commands.map((file) => {
    // eslint-disable-next-line node/global-require, import/no-dynamic-require
    const data = require(file)
    const command = commandFromPath(file)
    const [parentCommand] = command.split(':')
    const parent = command === parentCommand
    // remove hidden flags
    const flags =
      data.flags &&
      mapObj(
        filterObj(data.flags, (_, value) => value.hidden !== true),
        (flag, flagData) => [flag, { ...flagData, type: flagData.type === 'option' ? 'string' : flagData.type }],
      )
    return {
      command,
      commandGroup: parentCommand,
      isParent: parent,
      path: file,
      data: { ...data, flags },
    }
  })

  const visibleCommands = allCommands.filter((cmd) => {
    return !cmd.data.hidden
  })

  const groupedCommands = visibleCommands.reduce((acc, curr) => {
    if (curr.commandGroup === curr.command) {
      acc[curr.commandGroup] = {
        name: curr.command,
        usage: curr.data.usage,
        description: curr.data.description,
        flags: curr.data.flags,
        args: curr.data.args,
        examples: curr.data.examples,
        strict: curr.data.strict,
        commands: [],
      }
    }
    return acc
  }, {})

  const groupedCommandsWithData = visibleCommands.reduce((acc, curr) => {
    if (curr.commandGroup !== curr.command) {
      // account for hidden parent commands
      if (acc[curr.commandGroup] && acc[curr.commandGroup].commands) {
        acc[curr.commandGroup].commands = acc[curr.commandGroup].commands.concat({
          name: curr.command,
          usage: curr.data.usage,
          description: curr.data.description,
          flags: curr.data.flags,
          args: curr.data.args,
          examples: curr.data.examples,
          strict: curr.data.strict,
        })
      }
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
  if (normalized.match(/node_modules/)) {
    // in: /node_modules/netlify-dev-plugin/src/commands/dev/exec.js
    // out: /src/commands/dev/exec.js
    normalized = normalized.replace(/\/node_modules\/((?:[^/]+)*)?\//, '/')
  }
  return normalized
    .replace(rootDir, '')
    .replace(/\\/g, '/')
    .replace('.js', '')
    .replace('/src/commands/', '')
    .replace('/index', '')
    .replace('/', ':')
}
