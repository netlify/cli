export const createWatchCommand = (program) => program
    .command('watch')
    .description('Watch for project deploy to finish')
    .addExamples([`netlify watch`, `git push && netlify watch`])
    .action(async (options, command) => {
    const { watch } = await import('./watch.js');
    await watch(options, command);
});
//# sourceMappingURL=index.js.map