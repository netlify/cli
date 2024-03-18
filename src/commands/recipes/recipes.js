import { basename } from 'path';
import { closest } from 'fastest-levenshtein';
import inquirer from 'inquirer';
import { NETLIFYDEVERR, chalk, log } from '../../utils/command-helpers.js';
import { getRecipe, listRecipes } from './common.js';
const SUGGESTION_TIMEOUT = 1e4;
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const runRecipe = async ({ config, recipeName, repositoryRoot }) => {
    const recipe = await getRecipe(recipeName);
    return recipe.run({ config, repositoryRoot });
};
export const recipesCommand = async (recipeName, options, command) => {
    const { config, repositoryRoot } = command.netlify;
    const sanitizedRecipeName = basename(recipeName || '').toLowerCase();
    if (sanitizedRecipeName.length === 0) {
        return command.help();
    }
    try {
        return await runRecipe({ config, recipeName: sanitizedRecipeName, repositoryRoot });
    }
    catch (error) {
        if (
        // The ESM loader throws this instead of MODULE_NOT_FOUND
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        error.code !== 'ERR_MODULE_NOT_FOUND') {
            throw error;
        }
        log(`${NETLIFYDEVERR} ${chalk.yellow(recipeName)} is not a valid recipe name.`);
        const recipes = await listRecipes();
        const recipeNames = recipes.map(({ name }) => name);
        const suggestion = closest(recipeName, recipeNames);
        const applySuggestion = await new Promise((resolve) => {
            const prompt = inquirer.prompt({
                type: 'confirm',
                name: 'suggestion',
                message: `Did you mean ${chalk.blue(suggestion)}`,
                default: false,
            });
            setTimeout(() => {
                // @ts-expect-error TS(2445) FIXME: Property 'close' is protected and only accessible ... Remove this comment to see the full error message
                prompt.ui.close();
                resolve(false);
            }, SUGGESTION_TIMEOUT);
            // eslint-disable-next-line promise/catch-or-return
            prompt.then((value) => resolve(value.suggestion));
        });
        if (applySuggestion) {
            return recipesCommand(suggestion, options, command);
        }
    }
};
