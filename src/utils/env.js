// dotenv loading similar to create-react-app / react-scripts or dotenv-load

const path = require('path')
const dotenv = require('dotenv')
const filterObject = require('filter-obj')
const { isFileAsync, readFileAsync } = require('../lib/fs')

async function getEnvSettings(projectDir) {
  const NODE_ENV = process.env.NODE_ENV || 'development'
  const dotenvPath = path.resolve(projectDir, '.env')

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

  // Load environment variables from .env* files.
  // Ignore missing files
  const results = await Promise.all(
    dotenvFiles.map(async file => {
      const isFile = await isFileAsync(file)
      if (!isFile) {
        return
      }
      const content = await readFileAsync(file)
      const parsed = dotenv.parse(content)
      // only keep envs not configured in process.env
      const env = filterObject(parsed, key => !Object.prototype.hasOwnProperty.call(process.env, key))
      return { file, env }
    })
  )

  const settings = results.filter(Boolean).reduce(
    ({ files, vars }, { file, env }) => {
      return { files: [...files, file], vars: { ...env, ...vars } }
    },
    { files: [], vars: {} }
  )
  return { ...settings, vars: Object.entries(settings.vars) }
}

module.exports.getEnvSettings = getEnvSettings
