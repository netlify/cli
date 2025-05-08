import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createRecipesCommand = (program: BaseCommand) => {
  program
    .command('recipes:list')
    .description(`List the recipes available to create and modify files in a project`)
    .addExamples(['netlify recipes:list'])
    .action(async () => {
      const { recipesListCommand } = await import('./recipes-list.js')
      await recipesListCommand()
    })

  return program
    .command('recipes')
    .argument('[name]', 'name of the recipe')
    .description(`Create and modify files in a project using pre-defined recipes`)
    .option('-n, --name <name>', 'recipe name to use')
    .option(
      '--skip-detection',
      'Skips automatic IDE detection. Use this with the ai-context recipe to specify paths manually.',
    )
    .addExamples(['netlify recipes my-recipe', 'netlify recipes --name my-recipe'])
    .action(async (recipeName: string, options: OptionValues, command: BaseCommand) => {
      const { recipesCommand } = await import('./recipes.js')
      await recipesCommand(recipeName, options, command)
    })
}
