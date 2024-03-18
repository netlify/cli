import { chalk } from '../../utils/command-helpers.js';
import { login } from '../login/login.js';
import { intro, outro, select } from '../../utils/styles/index.js';
const LOGIN_NEW = 'I would like to login to a new account';
export const switchCommand = async (_, command) => {
    intro('switch');
    const users = command.netlify.globalConfig.get('users') || {};
    const availableUsersChoices = Object.values(users).reduce((prev, current) => Object.assign(prev, {
        [current.id]: current.name ? `${current.name} (${current.email})` : current.email,
    }), {});
    const accountSelectOptions = {
        options: [
            ...Object.entries(availableUsersChoices).map(([, val]) => ({ label: val, value: val })),
            { label: LOGIN_NEW, value: LOGIN_NEW },
        ],
        message: 'Please select the account you want to use:',
    };
    const accountSwitchChoice = await select(accountSelectOptions);
    if (accountSwitchChoice === LOGIN_NEW) {
        await login({ new: true }, command);
    }
    else {
        const selectedAccount = Object.entries(availableUsersChoices).find(([, availableUsersChoice]) => availableUsersChoice === accountSwitchChoice);
        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        command.netlify.globalConfig.set('userId', selectedAccount[0]);
        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        outro({ exit: true, message: `You're now using ${chalk.bold(selectedAccount[1])}.` });
    }
    outro({ exit: true });
};
