import process from 'process'
import { isCI } from 'ci-info'

export const scriptedCommand = (argv: string[]): boolean => {
  // Is the command run in a non-interactive shell or CI/CD environment?
  const scriptedCommand = Boolean(!process.stdin.isTTY || isCI || process.env.CI)

  // Is not the base `netlify command w/o any flags
  const notNetlifyCommand = argv.length > 2

  // Is not the base `netlify` command w/ flags
  const notNetlifyCommandWithFlags = argv[2] && !(argv[2].startsWith('-'))

  // is not the `netlify help` command
  const notNetlifyHelpCommand = argv[2] && !(argv[2] === 'help')

  // Is the `--force` flag not already present?
  const noForceFlag = !argv.includes('--force')

  // Prevents prompts from blocking scripted commands
  return Boolean(
    scriptedCommand &&
    notNetlifyCommand &&
    notNetlifyCommandWithFlags &&
    notNetlifyHelpCommand &&
    noForceFlag
  )

}
