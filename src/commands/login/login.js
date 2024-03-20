import { chalk, getToken } from '../../utils/command-helpers.js';
import { NetlifyLog, intro, outro } from '../../utils/styles/index.js';
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
export const login = async (options, command) => {
    intro('login');
    const [accessToken, location] = await getToken();
    command.setAnalyticsPayload({ new: options.new });
    if (accessToken && !options.new) {
        NetlifyLog.success(`Already logged in ${msg(location)}`);
        NetlifyLog.message(`Run ${chalk.cyanBright('netlify status')} for account details`);
        NetlifyLog.message(`or run ${chalk.cyanBright('netlify switch')} to switch accounts`);
        outro({ message: `To see all available commands run: ${chalk.cyanBright('netlify help')}`, exit: true });
    }
    await command.expensivelyAuthenticate();
};
