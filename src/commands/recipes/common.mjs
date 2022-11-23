import fs from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const directoryPath = dirname(fileURLToPath(import.meta.url))

export const getRecipe = async (name) => {
  const recipePath = resolve(directoryPath, '../../recipes', name, 'index.mjs')

  // eslint-disable-next-line import/no-dynamic-require
  const recipe = await import(recipePath)

  return recipe
}

export const listRecipes = async () => {
  const recipesPath = resolve(directoryPath, '../../recipes')
  const recipeNames = await fs.readdir(recipesPath)
  const recipes = await Promise.all(
    recipeNames.map(async (name) => {
      const recipePath = join(recipesPath, name, 'index.mjs')

      // eslint-disable-next-line import/no-dynamic-require
      const recipe = await import(recipePath)

      return {
        ...recipe,
        name,
      }
    }),
  )

  return recipes
}
