const path = require('path')

const parseIgnore = require('parse-gitignore')

const { readFileAsync, writeFileAsync, fileExistsAsync } = require('../lib/fs')

const hasGitIgnore = async function (dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const hasIgnore = await fileExistsAsync(gitIgnorePath)
  return hasIgnore
}

const ensureNetlifyIgnore = async function (dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const ignoreContent = '# Local Netlify folder\n.netlify'

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
    const newContents = `${gitIgnoreContents}\n${ignoreContent}`
    await writeFileAsync(gitIgnorePath, newContents, 'utf8')
  }
}

module.exports = ensureNetlifyIgnore
