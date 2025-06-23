export const createAiCommand = (program) => {
    // Add ai:start subcommand following CLI convention
    program
        .command('ai:start')
        .argument('<hash>', 'Project hash for AI initialization')
        .description('Start AI project initialization with hash')
        .action(async (hash, options, command) => {
        // Set the hash as the first argument for the command
        command.args = [hash];
        const { aiStartCommand } = await import('./ai-start.js');
        await aiStartCommand(options, command);
    });
    return program
        .command('ai')
        .description('AI-powered development tools')
        .action(async (options, command) => {
        const { aiCommand: mainAiCommand } = await import('./ai.js');
        mainAiCommand(options, command);
    });
};
//# sourceMappingURL=index.js.map