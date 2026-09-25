import fs from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

import type { RunRecipeOptions } from './recipes.js'

export interface Recipe {
  description: string
  run: (options: RunRecipeOptions) => Promise<unknown>
}

const directoryPath = dirname(fileURLToPath(import.meta.url))

export const getRecipe = async (name: string): Promise<Recipe> => {
  const recipePath = resolve(directoryPath, '../../recipes', name, 'index.js')

  // windows needs a URL for absolute paths

  const recipe = (await import(pathToFileURL(recipePath).href)) as Recipe

  return recipe
}

export const listRecipes = async (): Promise<(Recipe & { name: string })[]> => {
  const recipesPath = resolve(directoryPath, '../../recipes')
  const recipeNames = await fs.readdir(recipesPath)
  const recipes = await Promise.all(
    recipeNames.map(async (name) => {
      const recipePath = join(recipesPath, name, 'index.js')

      // windows needs a URL for absolute paths

      const recipe = (await import(pathToFileURL(recipePath).href)) as Recipe

      return {
        ...recipe,
        name,
      }
    }),
  )

  return recipes
}
