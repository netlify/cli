// @ts-check
const { readFile } = require('fs').promises
const path = require('path')

const dotenv = require('dotenv')

const { isFileAsync } = require('../lib/fs')

const { warn } = require('./command-helpers')

const loadDotEnvFiles = async function ({ envPriority, projectDir }) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envPriority })

  const filesWithWarning = response.filter((el) => el.warning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el) => el.file && el.env)
}

const defaultEnvPriority = ['.env', '.env.development', '.env.local', '.env.development.local']

const tryLoadDotEnvFiles = async ({ projectDir, dotenvFiles = defaultEnvPriority }) => {
  const results = await Promise.all(
    dotenvFiles.map(async (file) => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
          warning: `Failed reading env variables from file: ${filepath}: ${error.message}`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  return results.filter(Boolean)
}

module.exports = { loadDotEnvFiles, tryLoadDotEnvFiles }
