// dotenv loading similar to create-react-app / react-scripts or dotenv-load

const path = require('path')

const dotenv = require('dotenv')
const filterObject = require('filter-obj')

const { isFileAsync, readFileAsync } = require('../lib/fs')

const getEnvSettings = async function ({ projectDir, warn }) {
  const dotenvFiles = ['.env.development', '.env']
  const results = await Promise.all(
    dotenvFiles.map(async (file) => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        warn(`Failed reading env variables from file: ${filepath}: ${error.message}`)
        return
      }
      const content = await readFileAsync(filepath)
      const parsed = dotenv.parse(content)
      // only keep envs not configured in process.env
      const env = filterObject(parsed, (key) => !Object.prototype.hasOwnProperty.call(process.env, key))
      return { file, env }
    }),
  )

  const allResults = results.filter(Boolean)
  const files = allResults.map(({ file }) => file)
  const vars = Object.entries(Object.assign({}, ...allResults.reverse().map(({ env }) => env)))
  return { files, vars }
}

module.exports = { getEnvSettings }
