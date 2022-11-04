// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fs'.
const { promises: fs } = require('fs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'join'.
const { join, resolve } = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getRecipe'... Remove this comment to see the full error message
const getRecipe = (name: $TSFixMe) => {
  const recipePath = resolve(__dirname, '../../recipes', name, 'index.cjs')

  // eslint-disable-next-line import/no-dynamic-require, n/global-require
  const recipe = require(recipePath)

  return recipe
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'listRecipe... Remove this comment to see the full error message
const listRecipes = async () => {
  const recipesPath = resolve(__dirname, '../../recipes')
  const recipeNames = await fs.readdir(recipesPath)
  const recipes = await Promise.all(
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    recipeNames.map((name: $TSFixMe) => {
      const recipePath = join(recipesPath, name, 'index.cjs')

      // eslint-disable-next-line import/no-dynamic-require, n/global-require
      const recipe = require(recipePath)

      return {
        ...recipe,
        name,
      }
    }),
  )

  return recipes
}

module.exports = { getRecipe, listRecipes }
