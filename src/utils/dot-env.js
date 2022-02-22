// @ts-check
const { readFile } = require('fs').promises
const path = require('path')

const dotenv = require('dotenv')

const { isFileAsync } = require('../lib/fs')

const { warn } = require('./command-helpers')

const loadDotEnvFiles = async function ({ envFiles, projectDir }) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((el) => el.warning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el) => el.file && el.env)
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development', '.env']

const tryLoadDotEnvFiles = async ({ projectDir, dotenvFiles = defaultEnvFiles }) => {
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

  // we return in order of lowest to highest priority
  return results.filter(Boolean).reverse()
}

module.exports = { loadDotEnvFiles, tryLoadDotEnvFiles }
