import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

export const loadDotEnvFiles = async function ({ envFiles, projectDir }: { envFiles?: string[]; projectDir: string }) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((el) => el.warning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((result): result is { file: string; env: dotenv.DotenvParseOutput } =>
    Boolean(result.file && result.env),
  )
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: {
  dotenvFiles?: string[]
  projectDir: string
}) => {
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
          // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
          warning: `Failed reading env variables from file: ${filepath}: ${error.message}`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result): result is NonNullable<typeof result> => Boolean(result)).reverse()
}
