import { basename } from 'path';
import { closest } from 'fastest-levenshtein';
import inquirer from 'inquirer';
import { NETLIFYDEVERR, chalk, log } from '../../utils/command-helpers.mjs';
import { getRecipe, listRecipes } from './common.mjs';
import { createRecipesListCommand } from './recipes-list.mjs';
const SUGGESTION_TIMEOUT = 1e4;
/**
 * The recipes command
 * @param {string} recipeName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7023) FIXME: 'recipesCommand' implicitly has return type 'any' ... Remove this comment to see the full error message
const recipesCommand = async (recipeName, options, command) => {
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
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const runRecipe = async ({ config, recipeName, repositoryRoot }) => {
    const recipe = await getRecipe(recipeName);
    return recipe.run({ config, repositoryRoot });
};
/**
 * Creates the `netlify recipes` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createRecipesCommand = (program) => {
    createRecipesListCommand(program);
    program
        .command('recipes')
        .argument('[name]', 'name of the recipe')
        .description(`Create and modify files in a project using pre-defined recipes`)
        .option('-n, --name <name>', 'recipe name to use')
        .addExamples(['netlify recipes my-recipe', 'netlify recipes --name my-recipe'])
        .action(recipesCommand);
};
