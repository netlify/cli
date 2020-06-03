const path = require('path')
const globby = require('markdown-magic').globby

module.exports = function generateCommandData() {
  const commandsPath = path.join(__dirname, '..', 'src/commands')
  const netlifyDevPath = path.join(__dirname, '..', 'node_modules/netlify-dev-plugin/src/commands')
  // console.log('commandsPath', commandsPath)
  const commands = globby.sync([`${commandsPath}/**/**.js`, `${netlifyDevPath}/**/**.js`])

  const allCommands = commands.map(file => {
    let cmd = {}
    try {
      cmd = require(file)
    } catch (e) {
      throw e
    }
    const command = commandFromPath(file)
    const parentCommand = command.split(':')[0]
    const parent = command === parentCommand ? true : false
    return {
      command: command,
      commandGroup: parentCommand,
      isParent: parent,
      path: file,
      data: cmd,
    }
  })

  const visibleCommands = allCommands.filter(cmd => {
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

function commandFromPath(p) {
  let normalized = path.normalize(p)

  // console.log('commandFromPath', normalized)
  // console.log('process.cwd()', process.cwd())
  const rootDir = path.join(__dirname, '..')
  // Replace node_modules path for CLI plugins
  if (normalized.match(/node_modules/)) {
    /*
      in: /node_modules/netlify-dev-plugin/src/commands/dev/exec.js
      out: /src/commands/dev/exec.js
    */
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
