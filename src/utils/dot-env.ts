import { readFile } from 'fs/promises'
import path from 'path'

import dotenv, { DotenvParseOutput } from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

interface DotEnvFile {
  file: string
  env: DotenvParseOutput
}

interface DotEnvWarning {
  warning: string
}

type DotEnvResult = DotEnvFile | DotEnvWarning

interface LoadDotEnvFilesOptions {
  envFiles?: string[]
  projectDir: string
}

export const loadDotEnvFiles = async function ({
  envFiles,
  projectDir,
}: LoadDotEnvFilesOptions): Promise<DotEnvFile[]> {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const warnings = response.filter((result): result is DotEnvWarning => Object.hasOwn(result, 'warning'))
  warnings.forEach((result) => {
    warn(result.warning)
  })

  return response.filter((result): result is DotEnvFile => Object.hasOwn(result, 'env'))
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

interface TryLoadDotEnvFilesOptions {
  projectDir: string
  dotenvFiles?: string[]
}

export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: TryLoadDotEnvFilesOptions): Promise<DotEnvResult[]> => {
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
          warning: `Failed reading env variables from file: ${filepath}: ${
            error instanceof Error ? error.message : error
          }`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result): result is DotEnvResult => Boolean(result)).reverse()
}
