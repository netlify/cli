const path = require('path')
const fs = require('fs')
const { promisify } = require('util')

const fileStat = promisify(fs.stat)

async function getEnvFile(projectDir) {
  const envDevelopmentFile = path.resolve(projectDir, '.env.development')
  const envFile = path.resolve(projectDir, '.env')

  try {
    if ((await fileStat(envDevelopmentFile)).isFile()) return envDevelopmentFile
  } catch (err) {
    // nothing
  }
  try {
    if ((await fileStat(envFile)).isFile()) return envFile
  } catch (err) {
    // nothing
  }

  return undefined
}

module.exports.getEnvFile = getEnvFile
