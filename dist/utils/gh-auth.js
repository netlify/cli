// A simple ghauth inspired library for getting a personal access token
import http from 'http';
import process from 'process';
import { Octokit } from '@octokit/rest';
import getPort from 'get-port';
import inquirer from 'inquirer';
import { log } from './command-helpers.js';
import createDeferred from './create-deferred.js';
import openBrowser from './open-browser.js';
const SERVER_PORT = 3000;
const promptForAuthMethod = async () => {
    const authChoiceNetlify = 'Authorize with GitHub through app.netlify.com';
    const authChoiceToken = 'Authorize with a GitHub personal access token';
    const authChoices = [authChoiceNetlify, authChoiceToken];
    const { authMethod } = await inquirer.prompt([
        {
            type: 'list',
            name: 'authMethod',
            message: 'Netlify CLI needs access to your GitHub account to configure Webhooks and Deploy Keys. ' +
                'What would you like to do?',
            choices: authChoices,
        },
    ]);
    return authMethod === authChoiceNetlify;
};
/**
 * Authenticate with the netlify app
 */
export const authWithNetlify = async () => {
    const port = await getPort({ port: SERVER_PORT });
    const { promise: deferredPromise, reject: deferredReject, resolve: deferredResolve } = createDeferred();
    const server = http.createServer(function onRequest(req, res) {
        const parameters = new URLSearchParams((req.url ?? '').slice((req.url ?? '').indexOf('?') + 1));
        if (parameters.get('token')) {
            // TODO(serhalp): Parse payload to validate type actually conforms
            deferredResolve(Object.fromEntries(parameters));
            res.end(`${"<html><head><title>Logged in</title><script>if(history.replaceState){history.replaceState({},'','/')}</script><style>html{font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';line-height:1.5;background:rgb(18 24 31)}body{overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;width:100vw;}h3{margin:0}p{margin: 1rem 0 0.5rem}.card{position:relative;display:flex;flex-direction:column;width:75%;max-width:364px;padding:24px;background:white;color:rgb(18 24 31);border-radius:8px;box-shadow:rgb(6 11 16 / 20%) 0px 16px 24px, rgb(6 11 16 / 30%) 0px 6px 30px, rgb(6 11 16 / 40%) 0px 8px 10px;}</style></head>" +
                "<body><div class=card><h3>Logged in</h3><p>You're now logged into Netlify CLI with your "}${parameters.get('provider') ?? ''} credentials. Please close this window.</p></div>`);
            server.close();
            return;
        }
        res.end('BAD PARAMETERS');
        server.close();
        deferredReject(new Error('Got invalid parameters for CLI login'));
    });
    await new Promise(function waitForListening(resolve, reject) {
        server.on('error', reject);
        server.listen(port, () => {
            resolve(undefined);
        });
    });
    const webUI = process.env.NETLIFY_WEB_UI ?? 'https://app.netlify.com';
    const urlParams = new URLSearchParams({
        host: `http://localhost:${port.toString()}`,
        provider: 'github',
    });
    const url = `${webUI}/cli?${urlParams.toString()}`;
    await openBrowser({ url });
    return deferredPromise;
};
const getPersonalAccessToken = async () => {
    const { token } = await inquirer.prompt([
        {
            type: 'password',
            name: 'token',
            message: 'Your GitHub personal access token:',
            filter: (input) => input.trim(),
        },
    ]);
    return { token };
};
/**
 * Authenticate with the netlify app
 */
const authWithToken = async () => {
    const { token } = await getPersonalAccessToken();
    if (!token) {
        throw new Error('GitHub authentication failed');
    }
    const octokit = new Octokit({ auth: `token ${token}` });
    const { data: { login: user }, } = await octokit.users.getAuthenticated();
    return { token, user, provider: 'github' };
};
/**
 * Get a GitHub token
 */
export const getGitHubToken = async () => {
    log('');
    const withNetlify = await promptForAuthMethod();
    return withNetlify ? await authWithNetlify() : await authWithToken();
};
//# sourceMappingURL=gh-auth.js.map