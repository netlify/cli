// @ts-check
import { promises } from 'fs'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

const { readFile } = promises

export const loadDotEnvFiles = async function ({ projectDir }) {
  const response = await tryLoadDotEnvFiles({ projectDir })

  const filesWithWarning = response.filter((el) => el.warning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el) => el.file && el.env)
}

export const tryLoadDotEnvFiles = async ({ projectDir }) => {
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
