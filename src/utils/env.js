const path = require('path')
const dotenv = require('dotenv')
const { statAsync, readFileAsync } = require('../lib/fs')

async function getEnvSettings(projectDir) {
  const envDevelopmentFile = path.resolve(projectDir, '.env.development')
  const envFile = path.resolve(projectDir, '.env')

  const settings = {}

  try {
    if ((await statAsync(envFile)).isFile()) settings.file = envFile
  } catch (err) {
    // nothing
  }
  try {
    if ((await statAsync(envDevelopmentFile)).isFile()) settings.file = envDevelopmentFile
  } catch (err) {
    // nothing
  }

  if (settings.file) settings.vars = dotenv.parse(await readFileAsync(settings.file)) || {}

  return settings
}

module.exports.getEnvSettings = getEnvSettings
