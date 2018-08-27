const fs = require('fs')
const path = require('path')
const markdownMagic = require('markdown-magic')
const globby = require('markdown-magic').globby
const util = require('util')

process.env.DOCS_GEN = 'TRUE'

const commandData = generateCommandData()

const newLine = '\n\n'

const config = {
  transforms: {
    GENERATE_COMMANDS_DOCS(content, options, instance) {

      const command = path.basename(instance.originalPath, '.md')
      const info = commandData[command]
      console.log('info', info)

      if (info) {
        let md = ''
        // Parent Command
        md += formatDescription(info.description)
        md += formatUsage(command)
        md += formatArgs(info.args)
        md += formatFlags(info.flags)
        md += commandListSubCommandDisplay(info.commands)
        if (info.commands.length) {
          info.commands.forEach((subCmd) => {
            // Child Commands
            md += formatSubCommandTitle(subCmd.name)
            md += formatDescription(subCmd.description)
            md += formatUsage(subCmd.name)
            md += formatArgs(subCmd.args)
            md += formatFlags(subCmd.flags)
            md += `---\n`
          })
        }
        return md
      }
    },
    GENERATE_COMMANDS_LIST(content, options) {
      /* Generate Command List */
      let md = ''
      Object.keys(commandData).map((commandName) => {
        const info = commandData[commandName]
        md += commandListTitle(commandName)
        md += commandListDescription(info.description)
        md += commandListSubCommandDisplay(info.commands)
      })

      return md
    },
  },
}

// Generate docs
markdownMagic(['README.md', 'docs/**/**.md'], config, () => {
  /* Fix newline MDX TOC issue #https://github.com/mdx-js/mdx/issues/184#issuecomment-416093951 */
  const processedDocs = globby.sync([
    'docs/**/**.md',
  ])

  processedDocs.map((f) => {
    const filePath = path.resolve(f)
    const fileContents = fs.readFileSync(filePath, 'utf8')

    const updatedContents = fileContents.replace('<!-- AUTO-GENERATED-CONTENT:END -->', '\n<!-- AUTO-GENERATED-CONTENT:END -->')
    fs.writeFileSync(filePath, updatedContents)
  })
  console.log('Docs updated!')
})


function commandFromPath(p) {
  return p.replace(process.cwd(), '')
    .replace('.js', '')
    .replace('/src/commands/', '')
    .replace('/index', '')
    .replace('/', ':')
}

/* Start - Docs Templating logic */
function commandListTitle(command) {
  return `### [${command}](/commands/${command})${newLine}`
}

function commandListDescription(desc) {
  const cleanDescription = desc.split('\n')[0]
  return `${cleanDescription}${newLine}`
}

function commandListSubCommandDisplay(commands) {
  if (!commands.length) {
    return ''
  }
  let table = '| Subcommand | description  |\n';
  table += '|:--------------------------- |:-----|\n';
  commands.forEach((cmd) => {
    table += `| ${cmd.name} | ${cmd.description}  |\n`;
  })
  return `${table}${newLine}`
}
function formatUsage(commandName) {
  return `**Usage**

\`\`\`bash
netlify ${commandName}
\`\`\`\n\n`
}

function formatSubCommandTitle(cmdName) {
  return `## \`${cmdName}\`\n\n`
}

function formatDescription(desc) {
  return `${desc}\n\n`
}

function formatFlags(cmdFlags, command) {
  if (!cmdFlags) {
    return ''
  }
  const flagArray = Object.keys(cmdFlags)
  if (!flagArray.length) {
    return ''
  }
  let renderFlags = `**Flags**\n\n`

  renderFlags += flagArray.map((flag) => {

    const flagData = cmdFlags[flag]
    console.log('flag', flagData)
    if (!flagData.description) {
      throw new Error(`${command} missing flag description`)
    }

    return `- ${flag} (${flagData.type}) - ${flagData.description}`
  }).join('\n')

  renderFlags += `\n\n`

  return renderFlags
}

function formatArgs(cmdArgs) {
  if (!cmdArgs) {
    return ''
  }
  let renderArgs = `**Arguments**\n\n`

  renderArgs += cmdArgs.map((arg) => {
    console.log('arg', arg)
    return `- ${arg.name} - ${arg.description}`
  }).join('\n')
  renderArgs += `\n\n`
  return renderArgs
}
/* End - Docs Templating logic */

function generateCommandData() {
  const commandsPath = path.join(__dirname, 'src/commands')
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
