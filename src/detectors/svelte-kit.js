const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 3000

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@sveltejs/kit'])) return false

  // Everything below now assumes that we are within SvelteKit
  // For more details refer to https://github.com/sveltejs/kit/tree/master/packages/adapter-netlify

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['dev'],
    preferredCommand: 'svelte-kit dev',
  })

  return {
    framework: 'svelte-kit',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'static',
  }
}
