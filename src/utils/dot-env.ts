import { readFile } from 'fs/promises'
import path from 'path'

import dotenv, { type DotenvParseOutput } from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

interface LoadDotEnvFilesOptions {
  envFiles?: string[]
  projectDir: string
}

export interface DotEnvFile {
  file: string
  env: DotenvParseOutput
}

export interface DotEnvWarning {
  warning: string
}

type DotEnvResult = DotEnvFile | DotEnvWarning

export const loadDotEnvFiles = async function ({
  envFiles,
  projectDir,
}: LoadDotEnvFilesOptions): Promise<DotEnvFile[]> {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((result): result is DotEnvWarning => 'warning' in result)
  filesWithWarning.forEach((result) => {
    warn(result.warning)
  })

  return response.filter((result): result is DotEnvFile => 'file' in result && 'env' in result)
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

interface TryLoadDotEnvFilesOptions {
  dotenvFiles?: string[]
  projectDir: string
}

export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: TryLoadDotEnvFilesOptions): Promise<DotEnvResult[]> => {
  const results = await Promise.all(
    dotenvFiles.map(async (file): Promise<DotEnvResult | undefined> => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return undefined
        }
      } catch (error) {
        return {
          warning: `Failed reading env variables from file: ${filepath}: ${(error as Error).message}`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result): result is DotEnvResult => result !== undefined).reverse()
}
