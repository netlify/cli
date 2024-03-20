import process from 'process';
import { chalk } from '../../utils/command-helpers.js';
import { NetlifyLog, intro, outro, select } from '../../utils/styles/index.js';
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
export const logsBuild = async (options, command) => {
    intro('logs:deploy');
    await command.authenticate();
    const client = command.netlify.api;
    const { site } = command.netlify;
    const { id: siteId } = site;
    const userId = command.netlify.globalConfig.get('userId');
    const deploys = await client.listSiteDeploys({ siteId, state: 'building' });
    if (deploys.length === 0) {
        NetlifyLog.info('No active builds');
        outro({ exit: true });
    }
    let [deploy] = deploys;
    if (deploys.length > 1) {
        const result = await select({
            message: `Select a deploy\n\n${chalk.yellow('*')} indicates a deploy created by you`,
            maxItems: 7,
            options: deploys.map((dep) => ({
                label: getName({ deploy: dep, userId }),
                value: dep.id,
            })),
        });
        deploy = deploys.find((dep) => dep.id === result);
    }
    const { id } = deploy;
    const ws = getWebSocket(`wss://socketeer.services.netlify.com/build/logs`);
    ws.on('open', function open() {
        ws.send(JSON.stringify({ deploy_id: id, site_id: siteId, access_token: client.accessToken }));
    });
    ws.on('message', (data) => {
        const { message, section, type } = JSON.parse(data);
        NetlifyLog.message(message, { noSpacing: true });
        if (type === 'report' && section === 'building') {
            // end of build
            ws.close();
        }
    });
    ws.on('close', () => {
        outro({ message: 'Closing connection', exit: true });
    });
    process.on('SIGINT', () => {
        outro({ message: 'Closing connection', exit: true });
    });
};
