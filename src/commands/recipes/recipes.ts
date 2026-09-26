import { basename } from 'path'

import { closest } from 'fastest-levenshtein'
import { confirm } from '@inquirer/prompts'

import { NETLIFYDEVERR, chalk, log, type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

import { getRecipe, listRecipes } from './common.js'
import type { RecipesOptionValues } from './option_values.js'

const SUGGESTION_TIMEOUT = 1e4

export interface RunRecipeOptions {
  args: string[]
  command?: BaseCommand
  config: NormalizedCachedConfigConfig
  repositoryRoot: string
}

export const runRecipe = async ({ recipeName, ...options }: RunRecipeOptions & { recipeName: string }) => {
  const recipe = await getRecipe(recipeName)
  if (!recipe) {
    throw new Error(`${recipeName} is not a valid recipe name`)
  }

  await recipe.run(options)
}

export const recipesCommand = async (
  recipeName: string,
  options: RecipesOptionValues,
  command: BaseCommand,
): Promise<void> => {
  const { config, repositoryRoot } = command.netlify
  const sanitizedRecipeName = basename(recipeName || '').toLowerCase()

  if (sanitizedRecipeName.length === 0) {
    return command.help()
  }

  const args = command.args.slice(1)

  const recipe = await getRecipe(sanitizedRecipeName)
  if (recipe) {
    await recipe.run({ args, command, config, repositoryRoot })
    return
  }

  log(`${NETLIFYDEVERR} ${chalk.yellow(recipeName)} is not a valid recipe name.`)

  const recipes = await listRecipes()
  const recipeNames = recipes.map(({ name }) => name)
  const suggestion = closest(recipeName, recipeNames)
  const applySuggestion = await confirm(
    { message: `Did you mean ${chalk.blue(suggestion)}`, default: false },
    { signal: AbortSignal.timeout(SUGGESTION_TIMEOUT) },
  ).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'AbortPromptError') {
      return false
    }
    throw error
  })

  if (applySuggestion) {
    await recipesCommand(suggestion, options, command)
  }
}
