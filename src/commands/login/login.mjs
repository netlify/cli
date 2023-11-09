import { chalk, exit, getToken, log } from '../../utils/command-helpers.mjs';
// @ts-expect-error TS(7006) FIXME: Parameter 'location' implicitly has an 'any' type.
const msg = function (location) {
    switch (location) {
        case 'env':
            return 'via process.env.NETLIFY_AUTH_TOKEN set in your terminal session';
        case 'flag':
            return 'via CLI --auth flag';
        case 'config':
            return 'via netlify config on your machine';
        default:
            return '';
    }
};
/**
 * The login command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
export const login = async (options, command) => {
    // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
    const [accessToken, location] = await getToken();
    command.setAnalyticsPayload({ new: options.new });
    if (accessToken && !options.new) {
        log(`Already logged in ${msg(location)}`);
        log();
        log(`Run ${chalk.cyanBright('netlify status')} for account details`);
        log();
        log(`or run ${chalk.cyanBright('netlify switch')} to switch accounts`);
        log();
        log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`);
        log();
        return exit();
    }
    await command.expensivelyAuthenticate();
};
/**
 * Creates the `netlify login` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createLoginCommand = (program) => program
    .command('login')
    .description(`Login to your Netlify account
Opens a web browser to acquire an OAuth token.`)
    .option('--new', 'Login to new Netlify account')
    .action(login);
