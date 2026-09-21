import { basename } from 'path'

import { OptionValues } from 'commander'
import { closest } from 'fastest-levenshtein'

import { NETLIFYDEVERR, chalk, log } from '../../utils/command-helpers.js'
import { promptConfirm } from '../../utils/prompts/index.js'
import BaseCommand from '../base-command.js'

import { getRecipe, listRecipes } from './common.js'

const SUGGESTION_TIMEOUT = 1e4

export interface RunRecipeOptions {
  args: string[]
  command?: BaseCommand
  config: unknown
  recipeName: string
  repositoryRoot: string
}

export const runRecipe = async ({ args, command, config, recipeName, repositoryRoot }: RunRecipeOptions) => {
  const recipe = await getRecipe(recipeName)

  return recipe.run({ args, command, config, repositoryRoot })
}

export const recipesCommand = async (recipeName: string, options: OptionValues, command: BaseCommand): Promise<any> => {
  const { config, repositoryRoot } = command.netlify
  const sanitizedRecipeName = basename(recipeName || '').toLowerCase()

  if (sanitizedRecipeName.length === 0) {
    return command.help()
  }

  const args = command.args.slice(1)

  try {
    return await runRecipe({ args, command, config, recipeName: sanitizedRecipeName, repositoryRoot })
  } catch (error) {
    if (
      // The ESM loader throws this instead of MODULE_NOT_FOUND
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      error.code !== 'ERR_MODULE_NOT_FOUND'
    ) {
      throw error
    }

    log(`${NETLIFYDEVERR} ${chalk.yellow(recipeName)} is not a valid recipe name.`)

    const recipes = await listRecipes()
    const recipeNames = recipes.map(({ name }) => name)
    const suggestion = closest(recipeName, recipeNames)
    const applySuggestion = await promptConfirm({
      message: `Did you mean ${chalk.blue(suggestion)}?`,
      initialValue: false,
      signal: AbortSignal.timeout(SUGGESTION_TIMEOUT),
    })

    if (applySuggestion) {
      return recipesCommand(suggestion, options, command)
    }
  }
}
