import { getToken } from '../../utils/command-helpers.js';
import { NetlifyLog, intro, outro } from '../../utils/styles/index.js';
import { track } from '../../utils/telemetry/index.js';
export const logout = async (options, command) => {
    intro('logout');
    const [accessToken, location] = await getToken();
    if (!accessToken) {
        NetlifyLog.info(`You are already logged out`);
        outro({ message: 'To login run "netlify login"', exit: true });
    }
    await track('user_logout');
    // unset userID without deleting key
    command.netlify.globalConfig.set('userId', null);
    if (location === 'env') {
        NetlifyLog.warn('The "process.env.NETLIFY_AUTH_TOKEN" is still set in your terminal session');
        outro({ message: 'To logout completely, unset the environment variable', exit: true });
    }
    NetlifyLog.success('Logged you out of Netlify.');
    outro({ message: 'Come back soon!' });
};
