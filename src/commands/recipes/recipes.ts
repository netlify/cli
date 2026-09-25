import { basename } from 'path'

import type { OptionValues } from 'commander'
import { closest } from 'fastest-levenshtein'
import inquirer from 'inquirer'

import { NETLIFYDEVERR, chalk, log, type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

import { getRecipe, listRecipes } from './common.js'

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
  options: OptionValues,
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
    await recipesCommand(suggestion, options, command)
  }
}
