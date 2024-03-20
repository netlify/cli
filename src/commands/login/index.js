export const createLoginCommand = (program) => program
    .command('login')
    .description(`Login to your Netlify account
Opens a web browser to acquire an OAuth token.`)
    .option('--new', 'Login to new Netlify account')
    .action(async (options, command) => {
    const { login } = await import('./login.js');
    await login(options, command);
});
