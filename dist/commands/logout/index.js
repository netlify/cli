export const createLogoutCommand = (program) => program
    .command('logout', { hidden: true })
    .description('Logout of your Netlify account')
    .action(async (options, command) => {
    const { logout } = await import('./logout.js');
    await logout(options, command);
});
//# sourceMappingURL=index.js.map