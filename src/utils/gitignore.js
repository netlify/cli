const path = require('path')

const inquirer = require('inquirer')
const parseIgnore = require('parse-gitignore')

const { fileExistsAsync, readFileAsync, writeFileAsync } = require('../lib/fs')

const hasGitIgnore = async function (dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const hasIgnore = await fileExistsAsync(gitIgnorePath)
  return hasIgnore
}

const ensureNetlifyIgnore = async function (dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const ignoreContent = '# Local Netlify folder\n.netlify\n'

  /* No .gitignore file. Create one and ignore .netlify folder */
  if (!(await hasGitIgnore(dir))) {
    await writeFileAsync(gitIgnorePath, ignoreContent, 'utf8')
    return false
  }

  let gitIgnoreContents
  let ignorePatterns
  try {
    gitIgnoreContents = await readFileAsync(gitIgnorePath, 'utf8')
    ignorePatterns = parseIgnore.parse(gitIgnoreContents)
  } catch (error) {
    // ignore
  }
  /* Not ignoring .netlify folder. Add to .gitignore */
  if (!ignorePatterns || !ignorePatterns.patterns.some((pattern) => /(^|\/|\\)\.netlify($|\/|\\)/.test(pattern))) {
    const EDIT_GITIGNORE = 'Add local netlify folder to .gitignore'
    const LEAVE_GITIGNORE = 'Leave .gitignore as it is'

    const initializeOpts = [EDIT_GITIGNORE, LEAVE_GITIGNORE]

    const { initChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'initChoice',
        message: 'Would you like to add .netlify folder to .gitignore?',
        choices: initializeOpts,
      },
    ])
    // Edit .gitignore o ignore it
    if (initChoice === EDIT_GITIGNORE) {
      // edit .gitignore\
      const newContents = `${gitIgnoreContents}\n${ignoreContent}`
      await writeFileAsync(gitIgnorePath, newContents, 'utf8')
    } else if (initChoice === LEAVE_GITIGNORE) {
      // leave .gitignore\
    }
  }
}

module.exports = ensureNetlifyIgnore
