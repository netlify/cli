const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['svelte'])) return false
  // HAS DETECTOR, IT WILL BE PICKED UP BY SAPPER DETECTOR, avoid duplication https://github.com/netlify/cli/issues/347
  if (hasRequiredDeps(['sapper'])) return false

  /** everything below now assumes that we are within svelte */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['dev', 'start', 'run'],
    preferredCommand: 'npm run dev',
  })

  return {
    framework: 'svelte',
    command: getYarnOrNPMCommand(),
    frameworkPort: 5000,
    possibleArgsArrs,
    dist: 'public',
  }
}
