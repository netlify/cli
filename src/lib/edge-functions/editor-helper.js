const { env } = require('process')

const inquirer = require('inquirer')

const { runRecipe } = require('../../commands/recipes')

const STATE_PROMPT_PROPERTY = 'promptVSCodeSettings'

const promptEditorHelper = async ({ NETLIFYDEVLOG, chalk, config, log, repositoryRoot, state }) => {
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

  await runRecipe({ config, recipeName: 'vscode', repositoryRoot })
}

module.exports = { promptEditorHelper }
