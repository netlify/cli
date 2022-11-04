
const { promises: fs } = require('fs')

const { join, resolve } = require('path')


const getRecipe = (name: $TSFixMe) => {
  const recipePath = resolve(__dirname, '../../recipes', name, 'index.mjs')

  // eslint-disable-next-line import/no-dynamic-require, n/global-require
  const recipe = require(recipePath)

  return recipe
}


const listRecipes = async () => {
  const recipesPath = resolve(__dirname, '../../recipes')
  const recipeNames = await fs.readdir(recipesPath)
  const recipes = await Promise.all(
    
    recipeNames.map((name: $TSFixMe) => {
      const recipePath = join(recipesPath, name, 'index.mjs')

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

export default { getRecipe, listRecipes }
