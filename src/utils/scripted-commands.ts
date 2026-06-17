import process from 'process'
import { isCI } from 'ci-info'

import { BANG, chalk, exit } from './command-helpers.js'
import { EXIT_CODES } from './exit-codes.js'

export const NON_INTERACTIVE_FLAG = '--non-interactive'

const hasNonInteractiveFlag = (argv: string[] = process.argv): boolean => argv.includes(NON_INTERACTIVE_FLAG)

export const shouldForceFlagBeInjected = (argv: string[]): boolean => {
  // Is the command run in a non-interactive shell, CI/CD environment or with --non-interactive?
  const scriptedCommand = Boolean(!process.stdin.isTTY || isCI || process.env.CI || hasNonInteractiveFlag(argv))

  // Is the `--force` flag not already present?
  const noForceFlag = !argv.includes('--force')

  // ENV Variable used to tests prompts in CI/CD enviroment
  const testingPrompts = process.env.TESTING_PROMPTS !== 'true'

  // Prevents prompts from blocking scripted commands
  return Boolean(scriptedCommand && testingPrompts && noForceFlag)
}

export const isInteractive = (): boolean =>
  Boolean(process.stdin.isTTY && process.stdout.isTTY && !isCI && !process.env.CI && !hasNonInteractiveFlag())

export const injectForceFlagIfScripted = (argv: string[]) => {
  if (shouldForceFlagBeInjected(argv)) {
    argv.push('--force')
  }
}

/**
 * Fails fast (exit code 4, `EXIT_CODES.NON_INTERACTIVE_PROMPT`) when an interactive
 * prompt would have fired in a non-interactive session (CI or `--non-interactive`),
 * naming the prompt and the flag/env var that would supply the answer.
 */
export const failOnNonInteractivePrompt = (promptName: string, remediation: string): never => {
  const bang = chalk.red(BANG)
  process.stderr.write(
    ` ${bang}   Error: Cannot prompt for input in non-interactive mode (CI or ${NON_INTERACTIVE_FLAG}).\n`,
  )
  process.stderr.write(` ${bang}   Prompt: ${promptName}\n`)
  process.stderr.write(`${remediation}\n`)
  return exit(EXIT_CODES.NON_INTERACTIVE_PROMPT)
}
