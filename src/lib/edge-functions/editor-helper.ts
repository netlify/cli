import { env, stdin, stdout } from 'process'

import inquirer from 'inquirer'

import { runRecipe } from '../../commands/recipes/recipes.js'
import type {
  NormalizedCachedConfigConfig,
  chalk as helpersChalk,
  log as helpersLog,
} from '../../utils/command-helpers.js'
import type { LocalState } from '../../utils/types.js'

const STATE_PROMPT_PROPERTY = 'promptVSCodeSettings'

export const promptEditorHelper = async ({
  NETLIFYDEVLOG,
  chalk,
  config,
  log,
  repositoryRoot,
  state,
}: {
  NETLIFYDEVLOG: string
  chalk: typeof helpersChalk
  config: NormalizedCachedConfigConfig
  log: typeof helpersLog
  repositoryRoot: string
  state: LocalState
}) => {
  // This prevents tests from hanging when running them inside the VS Code
  // terminal, as otherwise we'll show the prompt and wait for a response.
  if (env.NODE_ENV === 'test') return

  if (!stdin.isTTY || !stdout.isTTY) return

  const isVSCode = env.TERM_PROGRAM === 'vscode'
  const hasShownPrompt = Boolean(state.get(STATE_PROMPT_PROPERTY))
  const hasEdgeFunctions = Boolean(config.edge_functions && config.edge_functions.length !== 0)

  if (!isVSCode || hasShownPrompt || !hasEdgeFunctions) {
    return
  }

  state.set(STATE_PROMPT_PROPERTY, true)

  const message = 'Would you like to configure VS Code to use Edge Functions?'
  const { confirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message,
    default: true,
  })

  if (!confirm) {
    log(
      `${NETLIFYDEVLOG} You can start this configuration manually by running ${chalk.magenta.bold(
        'netlify recipes vscode',
      )}.`,
    )

    return
  }

  await runRecipe({ args: [], config, recipeName: 'vscode', repositoryRoot })
}
