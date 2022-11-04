// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'AsciiTable... Remove this comment to see the full error message
const AsciiTable = require('ascii-table')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'listRecipe... Remove this comment to see the full error message
const { listRecipes } = require('./common.cjs')

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
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createReci... Remove this comment to see the full error message
const createRecipesListCommand = (program: $TSFixMe) => program
  .command('recipes:list')
  .description(`(Beta) List the recipes available to create and modify files in a project`)
  .addExamples(['netlify recipes:list'])
  .action(recipesListCommand)

module.exports = { createRecipesListCommand }
