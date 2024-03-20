/**
 * @typedef CompletionItem
 * @type import('tabtab').CompletionItem
 */
/**
 *
 * @param {import('tabtab').TabtabEnv} env
 * @param {Record<string, CompletionItem & {options: CompletionItem[]}>} program
 * @returns {CompletionItem[]|void}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'env' implicitly has an 'any' type.
const getAutocompletion = function (env, program) {
    if (!env.complete) {
        return;
    }
    // means that we are currently in the first command (the root command)
    if (env.words === 1) {
        // @ts-expect-error TS(2345) FIXME: Argument of type '({ description, name }: { descri... Remove this comment to see the full error message
        const rootCommands = Object.values(program).map(({ description, name }) => ({ name, description }));
        // suggest all commands
        // $ netlify <cursor>
        if (env.lastPartial.length === 0) {
            return rootCommands;
        }
        // $ netlify add<cursor>
        // we can now check if a command starts with the last partial
        // @ts-expect-error TS(2769) FIXME: No overload matches this call.
        const autocomplete = rootCommands.filter(({ name }) => name.startsWith(env.lastPartial));
        return autocomplete;
    }
    const [, command, ...args] = env.line.split(' ');
    if (program[command]) {
        const usedArgs = new Set(args);
        // @ts-expect-error TS(7031) FIXME: Binding element 'name' implicitly has an 'any' typ... Remove this comment to see the full error message
        const unusedOptions = program[command].options.filter(({ name }) => !usedArgs.has(name));
        if (env.lastPartial.length !== 0) {
            // @ts-expect-error TS(7031) FIXME: Binding element 'name' implicitly has an 'any' typ... Remove this comment to see the full error message
            return unusedOptions.filter(({ name }) => name.startsWith(env.lastPartial));
        }
        // suggest options that are not used
        return unusedOptions;
    }
};
export default getAutocompletion;
