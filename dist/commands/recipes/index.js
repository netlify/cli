export const createRecipesCommand = (program) => {
    program
        .command('recipes:list')
        .description(`List the recipes available to create and modify files in a project`)
        .addExamples(['netlify recipes:list'])
        .action(async () => {
        const { recipesListCommand } = await import('./recipes-list.js');
        await recipesListCommand();
    });
    return program
        .command('recipes')
        .argument('[name]', 'name of the recipe')
        .description(`Create and modify files in a project using pre-defined recipes`)
        .option('-n, --name <name>', 'recipe name to use')
        .addExamples(['netlify recipes my-recipe', 'netlify recipes --name my-recipe'])
        .action(async (recipeName, options, command) => {
        const { recipesCommand } = await import('./recipes.js');
        await recipesCommand(recipeName, options, command);
    });
};
//# sourceMappingURL=index.js.map