// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createReci... Remove this comment to see the full error message
const { createRecipesListCommand } = require('./recipes-list.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createReci... Remove this comment to see the full error message
const { createRecipesCommand, runRecipe } = require('./recipes.cjs')

module.exports = {
  createRecipesCommand,
  createRecipesListCommand,
  runRecipe,
}
