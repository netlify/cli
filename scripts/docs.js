const fs = require('fs')
const path = require('path')
const markdownMagic = require('markdown-magic')
const globby = require('markdown-magic').globby
const generateCommandData = require('./generateCommandData')

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
        md += commandExamples(info.examples)
        if (info.commands.length) {
          md += `---\n`
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
    GENERATE_COMMANDS_LIST(content, options, instance) {

      const context = path.basename(instance.originalPath, '.md')

      /* Generate Command List */
      let md = ''
      Object.keys(commandData).map((commandName) => {
        const info = commandData[commandName]
        md += commandListTitle(commandName, context)
        md += commandListDescription(info.description)
        md += commandListSubCommandDisplay(info.commands, context)
      })

      return md
    },
  },
}

const rootDir = path.join(__dirname, '..')
const markdownFiles = [
  path.join(rootDir, 'README.md'),
  path.join(rootDir, 'docs/**/**.md')
]

// Generate docs
markdownMagic(markdownFiles, config, () => {
  /* Fix newline MDX TOC issue #https://github.com/mdx-js/mdx/issues/184#issuecomment-416093951 */
  // const processedDocs = globby.sync([
  //   'docs/**/**.md',
  // ])
  //
  // processedDocs.map((f) => {
  //   const filePath = path.resolve(f)
  //   const fileContents = fs.readFileSync(filePath, 'utf8')
  //
  //   const updatedContents = fileContents.replace('<!-- AUTO-GENERATED-CONTENT:END -->', '\n<!-- AUTO-GENERATED-CONTENT:END -->')
  //   fs.writeFileSync(filePath, updatedContents)
  // })
  console.log('Docs updated!')
})

/* Start - Docs Templating logic */
function commandExamples(examples) {
  if (!examples || !examples.length) {
    return ''
  }
  let exampleRender = `**Examples**${newLine}`
  exampleRender += '\`\`\`bash\n'
  examples.forEach((ex) => {
    console.log('ex', ex)
    exampleRender += `${ex}\n`
  })
  exampleRender += `\`\`\`${newLine}`
  return exampleRender
}

/* Start - Docs Templating logic */
function commandListTitle(command, context) {
  const url  = (context === 'README') ? `/docs/commands/${command}.md` : `/commands/${command}`
  return `### [${command}](${url})${newLine}`
}

function commandListDescription(desc) {
  const cleanDescription = desc.split('\n')[0]
  return `${cleanDescription}${newLine}`
}

function commandListSubCommandDisplay(commands, context) {

  if (!commands.length) {
    return ''
  }
  let table = '| Subcommand | description  |\n';
  table += '|:--------------------------- |:-----|\n';
  commands.forEach((cmd) => {
    const commandBase = cmd.name.split(':')[0]
    const baseUrl = (context === 'README') ? `/docs/commands/${commandBase}.md` : `/commands/${commandBase}`
    const slug = cmd.name.replace(/:/g, '')
    table += `| [\`${cmd.name}\`](${baseUrl}#${slug}) | ${cmd.description.split('\n')[0]}  |\n`;
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
    if (!flagData.description) {
      throw new Error(`${command} missing flag description`)
    }

    return `- \`${flag}\` (*${flagData.type}*) - ${flagData.description}`
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
    return `- ${arg.name} - ${arg.description}`
  }).join('\n')
  renderArgs += `\n\n`
  return renderArgs
}
/* End - Docs Templating logic */
