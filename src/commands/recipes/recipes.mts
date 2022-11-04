// @ts-check

const { basename } = require('path')


const inquirer = require('inquirer')
const { findBestMatch } = require('string-similarity')

const utils = require('../../utils/command-helpers.cjs')


const { getRecipe, listRecipes } = require('./common.cjs')

const SUGGESTION_TIMEOUT = 1e4

/**
 * The recipes command
 * @param {string} recipeName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(7023): 'recipesCommand' implicitly has return type 'any' ... Remove this comment to see the full error message
const recipesCommand = async (recipeName: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
  const { config, repositoryRoot } = command.netlify
  const sanitizedRecipeName = basename(recipeName || '').toLowerCase()

  if (sanitizedRecipeName.length === 0) {
    return command.help()
  }

  try {
    return await runRecipe({ config, recipeName: sanitizedRecipeName, repositoryRoot })
  } catch (error) {
    
    if ((error as $TSFixMe).code !== 'MODULE_NOT_FOUND') {
      throw error
    }

    utils.log(`${utils.NETLIFYDEVERR} ${utils.chalk.yellow(recipeName)} is not a valid recipe name.`)

    const recipes = await listRecipes()
    const recipeNames = recipes.map(({
      name
    
    }: $TSFixMe) => name)
    const {
      bestMatch: { target: suggestion },
    } = findBestMatch(recipeName, recipeNames)
    const applySuggestion = await new Promise((resolve) => {
      const prompt = inquirer.prompt({
        type: 'confirm',
        name: 'suggestion',
        message: `Did you mean ${utils.chalk.blue(suggestion)}`,
        default: false,
      })

      setTimeout(() => {
        prompt.ui.close()
        resolve(false)
      }, SUGGESTION_TIMEOUT)

      
      // eslint-disable-next-line promise/catch-or-return
      prompt.then((value: $TSFixMe) => resolve(value.suggestion))
    })

    if (applySuggestion) {
      return recipesCommand(suggestion, options, command)
    }
  }
}


const runRecipe = ({
  config,
  recipeName,
  repositoryRoot

}: $TSFixMe) => {
  const recipe = getRecipe(recipeName)

  return recipe.run({ config, repositoryRoot })
}

/**
 * Creates the `netlify recipes` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

const createRecipesCommand = (program: $TSFixMe) => program
  .command('recipes')
  .argument('[name]', 'name of the recipe')
  .description(`(Beta) Create and modify files in a project using pre-defined recipes`)
  .option('-n, --name <name>', 'recipe name to use')
  .addExamples(['netlify recipes my-recipe', 'netlify recipes --name my-recipe'])
  .action(recipesCommand)

module.exports = { createRecipesCommand, runRecipe }
