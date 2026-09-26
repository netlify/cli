import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'
import { getErrorMessage } from './errors.js'

interface DotEnvFile {
  file: string
  env: dotenv.DotenvParseOutput
  warning?: undefined
}

interface DotEnvFileWarning {
  file?: undefined
  env?: undefined
  warning: string
}

export const loadDotEnvFiles = async function ({
  envFiles,
  projectDir,
}: {
  envFiles?: string[] | undefined
  projectDir: string
}): Promise<DotEnvFile[]> {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((el) => el.warning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el): el is DotEnvFile => Boolean(el.file && el.env))
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: {
  dotenvFiles?: string[] | undefined
  projectDir: string
}): Promise<(DotEnvFile | DotEnvFileWarning)[]> => {
  const results = await Promise.all(
    dotenvFiles.map(async (file): Promise<DotEnvFile | DotEnvFileWarning | undefined> => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
          warning: `Failed reading env variables from file: ${filepath}: ${getErrorMessage(error)}`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result) => result !== undefined).reverse()
}
