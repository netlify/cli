import fs from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

// @ts-expect-error TS(1470) FIXME: The 'import.meta' meta-property is not allowed in ... Remove this comment to see the full error message
const directoryPath = dirname(fileURLToPath(import.meta.url))

// @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
export const getRecipe = async (name) => {
  const recipePath = resolve(directoryPath, '../../recipes', name, 'index.mjs')

  // windows needs a URL for absolute paths

  const recipe = await import(pathToFileURL(recipePath).href)

  return recipe
}

export const listRecipes = async () => {
  const recipesPath = resolve(directoryPath, '../../recipes')
  const recipeNames = await fs.readdir(recipesPath)
  const recipes = await Promise.all(
    recipeNames.map(async (name) => {
      const recipePath = join(recipesPath, name, 'index.mjs')

      // windows needs a URL for absolute paths

      const recipe = await import(pathToFileURL(recipePath).href)

      return {
        ...recipe,
        name,
      }
    }),
  )

  return recipes
}
