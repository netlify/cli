// @ts-check
const { readFile, writeFile } = require('fs').promises
const path = require('path')

const parseIgnore = require('parse-gitignore')

const { fileExistsAsync } = require('../lib/fs')

const { log } = require('./command-helpers')

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
    await writeFile(gitIgnorePath, ignoreContent, 'utf8')
    return false
  }

  let gitIgnoreContents
  let ignorePatterns
  try {
    gitIgnoreContents = await readFile(gitIgnorePath, 'utf8')
    ignorePatterns = parseIgnore.parse(gitIgnoreContents)
  } catch {
    // ignore
  }
  /* Not ignoring .netlify folder. Add to .gitignore */
  if (!ignorePatterns || !ignorePatterns.patterns.some((pattern) => /(^|\/|\\)\.netlify($|\/|\\)/.test(pattern))) {
    log()
    log('Adding local .netlify folder to .gitignore file...')
    const newContents = `${gitIgnoreContents}\n${ignoreContent}`
    await writeFile(gitIgnorePath, newContents, 'utf8')
  }
}

module.exports = { ensureNetlifyIgnore }
