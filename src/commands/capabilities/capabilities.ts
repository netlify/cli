import type { Command, Option, OptionValues } from 'commander'

import { getPathInHome } from '../../lib/settings.js'
import { EXIT_CODES } from '../../utils/exit-codes.js'
import getCLIPackageJson from '../../utils/get-cli-package-json.js'
import type BaseCommand from '../base-command.js'

const CONTRACT_VERSION = '1'

const GLOBAL_FLAG_THRESHOLD = 0.8

const EXIT_CODE_DESCRIPTIONS: Record<string, string> = {
  [String(EXIT_CODES.SUCCESS)]: 'success',
  [String(EXIT_CODES.GENERAL_ERROR)]: 'general error',
  [String(EXIT_CODES.USAGE_ERROR)]: 'usage error',
  [String(EXIT_CODES.NON_INTERACTIVE_PROMPT)]: 'non-interactive prompt blocked',
}

const ENV_VARS = [
  { name: 'CI', description: 'When set, forces non-interactive mode (no prompts)' },
  { name: 'CONTEXT', description: 'Deploy context used when resolving environment variables (e.g. dev, production)' },
  { name: 'NETLIFY_AUTH_TOKEN', description: 'Auth token (alternative to netlify login)' },
  { name: 'NETLIFY_SITE_ID', description: 'Default site id (alternative to netlify link)' },
  { name: 'NO_COLOR', description: 'Disable colors in output' },
]

interface FlagManifest {
  name: string
  type: 'boolean' | 'string'
  description: string
}

interface CommandManifest {
  name: string
  description: string
  flags: FlagManifest[]
  json_output: boolean
  mutates: null
}

const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name)

const toFlagManifest = (option: Option): FlagManifest => ({
  name: option.long ?? option.flags,
  type: option.required || option.optional ? 'string' : 'boolean',
  description: option.description,
})

const collectCommands = (root: Command): Command[] => {
  const collected: Command[] = []
  const walk = (commands: readonly Command[]) => {
    commands.forEach((cmd) => {
      collected.push(cmd)
      walk(cmd.commands)
    })
  }
  walk(root.commands)
  return collected
}

const toCommandManifest = (cmd: Command): CommandManifest => ({
  name: cmd.name(),
  description: cmd.description(),
  flags: cmd.options.map(toFlagManifest).sort(byName),
  json_output: cmd.options.some((option) => option.long === '--json'),
  mutates: null,
})

const getGlobalFlags = (commands: Command[]): FlagManifest[] => {
  const occurrences = new Map<string, { count: number; option: Option }>()
  commands.forEach((cmd) => {
    cmd.options.forEach((option) => {
      if (!option.long) return
      const seen = occurrences.get(option.long)
      if (seen) {
        seen.count += 1
      } else {
        occurrences.set(option.long, { count: 1, option })
      }
    })
  })

  const globalFlags = [...occurrences.values()]
    .filter(({ count }) => count >= commands.length * GLOBAL_FLAG_THRESHOLD)
    .map(({ option }) => toFlagManifest(option))

  globalFlags.push({ name: '--help', type: 'boolean', description: 'Display help for command' })

  return globalFlags.sort(byName)
}

export const buildCapabilitiesManifest = async (program: Command) => {
  const { version } = await getCLIPackageJson()
  const commands = collectCommands(program)

  return {
    contract_version: CONTRACT_VERSION,
    cli_version: version,
    commands: commands.map(toCommandManifest).sort(byName),
    global_flags: getGlobalFlags(commands),
    exit_codes: EXIT_CODE_DESCRIPTIONS,
    env_vars: ENV_VARS,
    config_files: [
      { path: 'netlify.toml', scope: 'project' },
      { path: '.netlify/state.json', scope: 'project-state' },
      { path: getPathInHome(['config.json']), scope: 'global' },
    ],
  }
}

export const capabilities = async (_options: OptionValues, command: BaseCommand) => {
  let root: Command = command
  while (root.parent) {
    root = root.parent
  }
  const manifest = await buildCapabilitiesManifest(root)
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
}
