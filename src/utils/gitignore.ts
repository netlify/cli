// @ts-check
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'readFile'.
const { readFile, writeFile } = require('fs').promises
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
const path = require('path')

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const parseIgnore = require('parse-gitignore')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'fileExists... Remove this comment to see the full error message
const { fileExistsAsync } = require('../lib/fs.cjs')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'log'.
const { log } = require('./command-helpers.cjs')

const hasGitIgnore = async function (dir: any) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const hasIgnore = await fileExistsAsync(gitIgnorePath)
  return hasIgnore
}

const ensureNetlifyIgnore = async function (dir: any) {
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
  if (!ignorePatterns || !ignorePatterns.patterns.some((pattern: any) => /(^|\/|\\)\.netlify($|\/|\\)/.test(pattern))) {
    log()
    log('Adding local .netlify folder to .gitignore file...')
    const newContents = `${gitIgnoreContents}\n${ignoreContent}`
    await writeFile(gitIgnorePath, newContents, 'utf8')
  }
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { ensureNetlifyIgnore }
