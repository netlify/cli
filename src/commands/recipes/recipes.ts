import { basename } from 'path'

import { closest } from 'fastest-levenshtein'
import inquirer from 'inquirer'

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

export const runRecipe = async ({
  args,
  command,
  config,
  recipeName,
  repositoryRoot,
}: RunRecipeOptions & { recipeName: string }) => {
  const recipe = await getRecipe(recipeName)

  return recipe.run({ args, command, config, repositoryRoot })
}

export const recipesCommand = async (
  recipeName: string,
  options: RecipesOptionValues,
  command: BaseCommand,
): Promise<unknown> => {
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
      (error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND'
    ) {
      throw error
    }

    log(`${NETLIFYDEVERR} ${chalk.yellow(recipeName)} is not a valid recipe name.`)

    const recipes = await listRecipes()
    const recipeNames = recipes.map(({ name }) => name)
    const suggestion = closest(recipeName, recipeNames)
    const applySuggestion = await new Promise<boolean>((resolve) => {
      const prompt = inquirer.prompt<{ suggestion: boolean }>({
        type: 'confirm',
        name: 'suggestion',
        message: `Did you mean ${chalk.blue(suggestion)}`,
        default: false,
      })

      setTimeout(() => {
        // @ts-expect-error FIXME(@types/inquirer): `close()` is protected, but it's the only way to dismiss a pending prompt
        prompt.ui.close()
        resolve(false)
      }, SUGGESTION_TIMEOUT)

      void prompt.then((value) => {
        resolve(value.suggestion)
      })
    })

    if (applySuggestion) {
      return recipesCommand(suggestion, options, command)
    }
    return undefined
  }
}
