const path = require('path')
const globby = require('markdown-magic').globby

module.exports = function generateCommandData() {
  const commandsPath = path.join(__dirname, '..', 'src/commands')
  console.log('commandsPath', commandsPath)
  const commands = globby.sync([`${commandsPath}/**/**.js`])

  const allCommands = commands.map((file) => {
    let cmd = {}
    try {
      cmd = require(file)
    } catch (e) {
      throw e
    }
    const command = commandFromPath(file)
    const parentCommand = command.split(':')[0]
    const parent = (command === parentCommand) ? true : false
    return {
      command: command,
      commandGroup: parentCommand,
      isParent: parent,
      path: file,
      data: cmd
    }
  })

  const visibleCommands = allCommands.filter((cmd) => {
    return !cmd.data.hidden
  })

  console.log('visibleCommands', visibleCommands)

  const groupedCommands = visibleCommands.reduce((acc, curr) => {
    if (curr.commandGroup === curr.command) {
      acc[curr.commandGroup] = {
        name: curr.command,
        description: curr.data.description,
        flags: curr.data.flags,
        args: curr.data.args,
        examples: curr.data.examples,
        strict: curr.data.strict,
        commands: []
      }
    }
    return acc
  }, {})

  const groupedCommandsWithData = visibleCommands.reduce((acc, curr) => {
    if (curr.commandGroup !== curr.command) {
      acc[curr.commandGroup].commands = acc[curr.commandGroup].commands.concat({
        name: curr.command,
        description: curr.data.description,
        flags: curr.data.flags,
        args: curr.data.args,
        examples: curr.data.examples,
        strict: curr.data.strict
      })
    }
    return acc
  }, groupedCommands)

  return groupedCommandsWithData
}

function commandFromPath(p) {
  console.log('commandFromPath', p)
  console.log('process.cwd()', process.cwd())
  const rootDir = path.join(__dirname, '..')
  console.log('rootDir', rootDir)
  return p.replace(rootDir, '')
    .replace('.js', '')
    .replace('/src/commands/', '')
    .replace('/index', '')
    .replace('/', ':')
}
