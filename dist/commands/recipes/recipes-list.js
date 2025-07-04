import AsciiTable from 'ascii-table';
import { listRecipes } from './common.js';
/**
 * The recipes:list command
 */
export const recipesListCommand = async () => {
    const recipes = await listRecipes();
    const table = new AsciiTable(`Usage: netlify recipes <name>`);
    table.setHeading('Name', 'Description');
    recipes.forEach(({ description, name }) => {
        table.addRow(name, description);
    });
    console.log(table.toString());
};
//# sourceMappingURL=recipes-list.js.map