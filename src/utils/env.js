const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const dotenv = require('dotenv')

const fileStat = promisify(fs.stat)
const readFile = promisify(fs.readFile)

async function getEnvSettings(projectDir) {
  const envDevelopmentFile = path.resolve(projectDir, '.env.development')
  const envFile = path.resolve(projectDir, '.env')

  const settings = {}

  try {
    if ((await fileStat(envFile)).isFile()) settings.file = envFile
  } catch (err) {
    // nothing
  }
  try {
    if ((await fileStat(envDevelopmentFile)).isFile()) settings.file = envDevelopmentFile
  } catch (err) {
    // nothing
  }

  if (settings.file) settings.vars = dotenv.parse(await readFile(settings.file)) || {}

  return settings
}

module.exports.getEnvSettings = getEnvSettings
