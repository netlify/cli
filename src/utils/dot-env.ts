// @ts-check
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
const path = require('path')

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const dotenv = require('dotenv')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'isFileAsyn... Remove this comment to see the full error message
const { isFileAsync } = require('../lib/fs.cjs')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'warn'.
const { warn } = require('./command-helpers.cjs')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'loadDotEnv... Remove this comment to see the full error message
const loadDotEnvFiles = async function ({
  envFiles,
  projectDir
}: any) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((el) => el.warning)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el) => el.file && el.env)
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

const tryLoadDotEnvFiles = async ({
  projectDir,
  dotenvFiles = defaultEnvFiles
}: any) => {
  const results = await Promise.all(
    // @ts-expect-error TS(7006) FIXME: Parameter 'file' implicitly has an 'any' type.
    dotenvFiles.map(async (file) => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
    warning: `Failed reading env variables from file: ${filepath}: ${(error as any).message}`,
};
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter(Boolean).reverse()
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { loadDotEnvFiles, tryLoadDotEnvFiles }
