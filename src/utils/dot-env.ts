import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

interface DotEnvFile {
  file: string
  env: Record<string, string>
}

interface DotEnvWarning {
  warning: string
}

type LoadedDotEnvFile = DotEnvFile | DotEnvWarning | undefined

const isDefined = <T>(value: T): value is NonNullable<T> => value !== undefined && value !== null
const isWarning = (result: LoadedDotEnvFile): result is DotEnvWarning => isDefined(result) && 'warning' in result
const isDotEnvFile = (result: LoadedDotEnvFile): result is DotEnvFile =>
  isDefined(result) && 'file' in result && 'env' in result

interface LoadDotEnvFilesOptions {
  envFiles: string[]
  projectDir: string
}

export const loadDotEnvFiles = async function ({
  envFiles,
  projectDir,
}: LoadDotEnvFilesOptions): Promise<DotEnvFile[]> {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter(isWarning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter(isDotEnvFile)
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
}: TryLoadDotEnvFilesOptions): Promise<LoadedDotEnvFile[]> => {
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
          warning: `Failed reading env variables from file: ${filepath}: ${error instanceof Error ? error.message : error}`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter(isDefined).reverse()
}
