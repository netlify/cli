const getAutocompletion = function (env, program) {
    if (!env.complete) {
        return;
    }
    // means that we are currently in the first command (the root command)
    if (env.words === 1) {
        const rootCommands = Object.values(program).map(({ description, name }) => ({ name, description }));
        // suggest all commands
        // $ netlify <cursor>
        if (env.lastPartial.length === 0) {
            return rootCommands;
        }
        // $ netlify add<cursor>
        // we can now check if a command starts with the last partial
        const autocomplete = rootCommands.filter(({ name }) => name.startsWith(env.lastPartial));
        return autocomplete;
    }
    const [, command, ...args] = env.line.split(' ');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (program[command]) {
        const usedArgs = new Set(args);
        const unusedOptions = program[command].options.filter(({ name }) => !usedArgs.has(name));
        if (env.lastPartial.length !== 0) {
            return unusedOptions.filter(({ name }) => name.startsWith(env.lastPartial));
        }
        // suggest options that are not used
        return unusedOptions;
    }
};
export default getAutocompletion;
//# sourceMappingURL=get-autocompletion.js.map