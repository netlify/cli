import type { RunRecipeOptions } from './recipes.js'

export interface Recipe {
  description: string
  run: (options: RunRecipeOptions) => Promise<unknown>
}

const recipeLoaders = {
  'ai-context': () => import('../../recipes/ai-context/index.js'),
  'blobs-migrate': () => import('../../recipes/blobs-migrate/index.js'),
  vscode: () => import('../../recipes/vscode/index.js'),
} satisfies Record<string, () => Promise<Recipe>>

type RecipeName = keyof typeof recipeLoaders

const isRecipeName = (name: string): name is RecipeName => Object.hasOwn(recipeLoaders, name)

export const getRecipe = async (name: string): Promise<Recipe | undefined> =>
  isRecipeName(name) ? await recipeLoaders[name]() : undefined

export const listRecipes = async () =>
  await Promise.all(
    Object.entries(recipeLoaders).map(async ([name, load]) => {
      const { description }: Recipe = await load()
      return { description, name }
    }),
  )
