// @ts-check
import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.mjs'

import { warn } from './command-helpers.mjs'

export const loadDotEnvFiles = async function ({ envFiles, projectDir }) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((el) => el.warning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el) => el.file && el.env)
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

export const tryLoadDotEnvFiles = async ({ dotenvFiles = defaultEnvFiles, projectDir }) => {
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
