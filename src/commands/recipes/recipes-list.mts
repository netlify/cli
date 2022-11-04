// @ts-check

const AsciiTable = require('ascii-table')


const { listRecipes } = require('./common.mjs')

/**
 * The recipes:list command
 */
const recipesListCommand = async () => {
  const recipes = await listRecipes()
  const table = new AsciiTable(`Usage: netlify recipes <name>`)

  table.setHeading('Name', 'Description')

  recipes.forEach(({
    description,
    name
  
  }: $TSFixMe) => {
    table.addRow(name, description)
  })

  console.log(table.toString())
}

/**
 * Creates the `netlify recipes:list` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createRecipesListCommand = (program: $TSFixMe) => program
  .command('recipes:list')
  .description(`(Beta) List the recipes available to create and modify files in a project`)
  .addExamples(['netlify recipes:list'])
  .action(recipesListCommand)

export default { createRecipesListCommand }
