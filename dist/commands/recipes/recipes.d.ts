import { OptionValues } from 'commander';
import BaseCommand from '../base-command.js';
export interface RunRecipeOptions {
    args: string[];
    command?: BaseCommand;
    config: unknown;
    recipeName: string;
    repositoryRoot: string;
}
export declare const runRecipe: ({ args, command, config, recipeName, repositoryRoot }: RunRecipeOptions) => Promise<any>;
export declare const recipesCommand: (recipeName: string, options: OptionValues, command: BaseCommand) => Promise<any>;
//# sourceMappingURL=recipes.d.ts.map