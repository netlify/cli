// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dotenv'.
const dotenv = require('dotenv')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isFileAsyn... Remove this comment to see the full error message
const { isFileAsync } = require('../lib/fs.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'warn'.
const { warn } = require('./command-helpers.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'loadDotEnv... Remove this comment to see the full error message
const loadDotEnvFiles = async function ({
  envFiles,
  projectDir
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const filesWithWarning = response.filter((el: $TSFixMe) => el.warning)
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  filesWithWarning.forEach((el: $TSFixMe) => {
    warn(el.warning)
  })

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return response.filter((el: $TSFixMe) => el.file && el.env);
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

const tryLoadDotEnvFiles = async ({
  projectDir,
  dotenvFiles = defaultEnvFiles
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const results = await Promise.all(
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    dotenvFiles.map(async (file: $TSFixMe) => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    warning: `Failed reading env variables from file: ${filepath}: ${(error as $TSFixMe).message}`,
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

module.exports = { loadDotEnvFiles, tryLoadDotEnvFiles }
