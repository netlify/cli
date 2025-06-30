import inquirer from 'inquirer';
import { log, chalk } from '../../utils/command-helpers.js';
import { getWebSocket } from '../../utils/websockets/index.js';
export function getName({ deploy, userId }) {
    let normalisedName = '';
    const isUserDeploy = deploy.user_id === userId;
    switch (deploy.context) {
        case 'branch-deploy':
            normalisedName = 'Branch Deploy';
            break;
        case 'deploy-preview': {
            // Deploys via the CLI can have the `deploy-preview` context
            // but no review id because they don't come from a PR.
            //
            const id = deploy.review_id;
            normalisedName = id ? `Deploy Preview #${id}` : 'Deploy Preview';
            break;
        }
        default:
            normalisedName = 'Production';
    }
    if (isUserDeploy) {
        normalisedName += chalk.yellow('*');
    }
    return `(${deploy.id.slice(0, 7)}) ${normalisedName}`;
}
export const logsBuild = async (_options, command) => {
    await command.authenticate();
    const client = command.netlify.api;
    const { site } = command.netlify;
    const { id: siteId } = site;
    const userId = command.netlify.globalConfig.get('userId');
    if (!siteId) {
        log('You must link a project before attempting to view deploy logs');
        return;
    }
    const deploys = await client.listSiteDeploys({ siteId, state: 'building' });
    if (deploys.length === 0) {
        log('No active builds');
        return;
    }
    let [deploy] = deploys;
    if (deploys.length > 1) {
        const { result } = await inquirer.prompt({
            name: 'result',
            type: 'list',
            message: `Select a deploy\n\n${chalk.yellow('*')} indicates a deploy created by you`,
            choices: deploys.map((dep) => ({
                name: getName({ deploy: dep, userId }),
                value: dep.id,
            })),
        });
        deploy = deploys.find((dep) => dep.id === result) || deploy;
    }
    const { id } = deploy;
    const ws = getWebSocket(`wss://socketeer.services.netlify.com/build/logs`);
    ws.on('open', function open() {
        ws.send(JSON.stringify({ deploy_id: id, site_id: siteId, access_token: client.accessToken }));
    });
    ws.on('message', (data) => {
        const { message, section, type } = JSON.parse(data);
        log(message);
        if (type === 'report' && section === 'building') {
            // end of build
            ws.close();
        }
    });
    ws.on('close', () => {
        log('---');
    });
};
//# sourceMappingURL=build.js.map