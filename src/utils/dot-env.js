const path = require('path')

const dotenv = require('dotenv')

const { isFileAsync, readFileAsync } = require('../lib/fs')

const { warn: warn_ } = require('./command-helpers')

const loadDotEnvFiles = async function ({ projectDir, warnLog }) {
  const warn = warnLog || warn_
  const dotenvFiles = ['.env', '.env.development']
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
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  return results.filter(Boolean)
}

module.exports = { loadDotEnvFiles }
