// dotenv loading similar to create-react-app / react-scripts or dotenv-load

const path = require('path')
const dotenv = require('dotenv')
const { isFileAsync, readFileAsync } = require('../lib/fs')
const dotenvExpand = require('dotenv-expand')

async function getEnvSettings(projectDir) {
  const NODE_ENV = process.env.NODE_ENV || 'development'
  const dotenvPath = path.resolve(projectDir, '.env')

  const settings = {}

  // https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
  const dotenvFiles = [
    `${dotenvPath}.${NODE_ENV}.local`,
    `${dotenvPath}.${NODE_ENV}`,
    // Don't include `.env.local` for `test` environment
    // since normally you expect tests to produce the same
    // results for everyone
    NODE_ENV !== 'test' && `${dotenvPath}.local`,
    dotenvPath,
  ].filter(Boolean)

  // Load environment variables from .env* files. Suppress warnings using silent
  // if this file is missing. dotenv will never modify any environment variables
  // that have already been set.  Variable expansion is supported in .env files.
  // https://github.com/motdotla/dotenv
  // https://github.com/motdotla/dotenv-expand
  for (const dotenvFile of dotenvFiles) {
    const isFile = await isFileAsync(dotenvFile)
    if (isFile) {
      settings.files = settings.files || []
      settings.files.push(dotenvFile)
      const content = await readFileAsync(dotenvFile)
      const env = dotenvExpand({ parsed: dotenv.parse(content) })
      settings.vars = { ...env.parsed, ...settings.vars }
    }
  }
  return settings
}

module.exports.getEnvSettings = getEnvSettings
