// dotenv loading similar to create-react-app / react-scripts or dotenv-load

const path = require('path')
const dotenv = require('dotenv')
const filterObject = require('filter-obj')
const { isFileAsync, readFileAsync } = require('../lib/fs')

async function getEnvSettings(projectDir) {
  const dotenvFiles = ['.env.development', '.env']
  const results = await Promise.all(
    dotenvFiles.map(async file => {
      const filepath = path.resolve(projectDir, file)
      const isFile = await isFileAsync(filepath)
      if (!isFile) {
        return
      }
      const content = await readFileAsync(filepath)
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
