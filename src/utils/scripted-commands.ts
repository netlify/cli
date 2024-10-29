import process from 'process'
import { isCI } from 'ci-info'

export const shouldForceFlagBeInjected = (argv: string[]): boolean => {
  // Is the command run in a non-interactive shell or CI/CD environment?
  const scriptedCommand = Boolean(!process.stdin.isTTY || isCI || process.env.CI)
  // Is the `--force` flag not already present?
  const noForceFlag = !argv.includes('--force')

  // Prevents prompts from blocking scripted commands
  return Boolean(scriptedCommand && noForceFlag)
}

export const injectForceFlagIfScripted = (argv: string[]) => {
  // ENV Variable used to tests prompts in CI/CD enviroment
  if (process.env.TESTING_PROMPTS === 'true') return

  if (shouldForceFlagBeInjected(argv)) {
    argv.push('--force')
  }
}
