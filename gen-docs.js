const fs = require('fs')
const path = require('path')
const markdownMagic = require('markdown-magic') // eslint-disable-line
const globby = require('markdown-magic').globby // eslint-disable-line

process.env.DOCS_GEN = 'TRUE'

const toTitleCase = (str) => { // eslint-disable-line
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

const formatName = (string) => { // eslint-disable-line
  return toTitleCase(string.replace(/-/g, ' '));
}

const config = {
  transforms: {
    GENERATE_COMMANDS_LIST(content, options) {
      const lessonsPath = path.join(__dirname, 'src/commands')
      const files = fs.readdirSync(lessonsPath)

      const data = files.filter((file) => {
        const filePath = path.join(lessonsPath, file)
        const stat = fs.statSync(filePath)
        // return all directories
        return stat && stat.isDirectory()
      }).map((file) => {
        const filePath = path.join(lessonsPath, file)
        const cmdGroupName = path.basename(filePath)
        console.log("CMD", cmdGroupName)
        console.log('filePath', filePath)
        const commandFiles = globby.sync([`${filePath}/**/**.js`]);

        const commandGroups = commandFiles.map((file) => {
          let cmd = {}
          try {
            cmd = require(file)
          } catch (e) {
            throw e
          }
          return {
            path: file,
            data: cmd
          }
        }).filter((command) => {
          // return only live commands
          return !command.data.hidden
        })

        //commandGroups.

        console.log('commandGroups', commandGroups)
        // console.log('commandFiles', commandFiles)

        const subCommandData = generateSubCommandData(commandGroups)

        let md = `### ${formatName(file)}

${subCommandData}
    `
        return md
      })

      return data.join('\n');
    },
    // EXAMPLE_TABLE() {
    //   const examples = globby.sync(['**/package.json', '!node_modules/**/package.json', '!**/node_modules/**/package.json', '!package.json'])
    //   // Make table header
    //   let md = '| Example | Runtime  |\n'
    //   md += '|:--------------------------- |:-----|\n'
    //   examples.forEach((example) => {
    //     const data = JSON.parse(fs.readFileSync(example, 'utf8'))
    //     const dirname = path.dirname(example)
    //     const exampleUrl = `https://github.com/netlify/examples/tree/master/${dirname}`
    //     const runtime = 'foo'
    //     const description = (data.description) ? `<br/> ${data.description}` : ''
    //     // add table rows
    //     md += `| [${formatName(data.name)}](${exampleUrl}) ${description} | ${runtime} |\n`
    //   })
    //
    //   return md
    // },
  },
}

function generateSubCommandData(commandGroup) {

  const md = commandGroup.map((command) => {
    let cmdName = path.basename(command.path, '.js')
    let cmdGroupName = path.dirname(path.dirname(command.path))
    if (cmdGroupName === 'commands') {
      cmdGroupName = ''
    }
    if (cmdName === 'index') {
      cmdName = path.basename(path.dirname(command.path), '.js')
    }
    const data = command.data
    const desc = data.description
    const examples = data.examples

    let examplesRender = ''
    if (examples) {
      examplesRender = `\`\`\`\n`
      examples.forEach((example) => {
        examplesRender += `${example}\n`
      })
      examplesRender += `\`\`\``
    }

    return `#### ${path.basename(path.dirname(path.dirname(command.path)))}:${cmdName}

${desc}

${examplesRender}
`
  })

  return md.join('\n');
}

// build lessons table
function generateTable(commandFiles) {
  let md = '| Lesson | Final Code  |\n';
  md += '|:--------------------------- |:-----|\n';

  const commandGroups = commandFiles.map((file) => {
    let cmd = {}
    try {
      cmd = require(file)
    } catch (e) {
      throw e
    }
    return cmd
  })

  console.log('commandGroups', commandGroups)

  commandGroups.forEach((cmd) => {
    console.log('cmd.description', cmd.description)
  })

  return 'hi'

  examples.forEach((example) => {
    console.log(example)

    let mod = {}
    try {
      mod = require(example)
    } catch (e) {

    }
    console.log('mod', mod.description)
    console.log('flags', mod.flags)
    const contents = fs.readFileSync(example, 'utf8')
    const dirname = path.basename(path.dirname(example))
    const parentDir = path.basename(path.dirname(path.dirname(example)))

    console.log('dirname', dirname)
    const repoBase = 'https://github.com/DavidWells/serverless-workshop/tree/master'
    const baseLink = `${repoBase}/_instructor/${parentDir}/${dirname}`

    const lessonLink = baseLink.replace(/_instructor/g, 'lessons');
    const answersLink = baseLink.replace(/_instructor/g, 'lessons-code-complete');
    //console.log(content)
    const heading = contents.match(/^# (.*)/g)
    console.log('heading', heading)
    const description = (heading && heading[0]) ? heading[0].replace("# ", '') : '';
    // add table rows
    md += `| [${formatName(dirname)}](${lessonLink}) <br/> ${description} | [Complete Code](${answersLink})  |\n`;
    // md += baseLink
  });
  return md
}

const markdownPath = path.join(__dirname, 'README.md')
markdownMagic(markdownPath, config, () => {
  console.log('Docs updated!') // eslint-disable-line
})
