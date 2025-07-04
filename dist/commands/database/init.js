import { getAccount, getExtension, getJigsawToken, getPackageJSON, installExtension, spawnAsync } from './utils.js';
import { initDrizzle } from './drizzle.js';
import { NEON_DATABASE_EXTENSION_SLUG, NETLIFY_NEON_PACKAGE_NAME } from './constants.js';
import prettyjson from 'prettyjson';
import { log } from '../../utils/command-helpers.js';
export const init = async (options, command) => {
    const siteInfo = command.netlify.siteInfo;
    if (!command.siteId) {
        console.error(`The project must be linked with netlify link before initializing a database.`);
        return;
    }
    if (!command.netlify.api.accessToken || !siteInfo.account_id || !siteInfo.name) {
        throw new Error(`Please login with netlify login before running this command`);
    }
    const account = await getAccount(command, { accountId: siteInfo.account_id });
    const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '');
    const extension = await getExtension({
        accountId: siteInfo.account_id,
        netlifyToken: netlifyToken,
        slug: NEON_DATABASE_EXTENSION_SLUG,
    });
    if (!extension?.hostSiteUrl) {
        throw new Error(`Failed to get extension host site url when installing extension`);
    }
    const installNeonExtension = async () => {
        if (!account.name) {
            throw new Error(`Failed to install extension "${extension.name}"`);
        }
        const installed = await installExtension({
            accountId: siteInfo.account_id,
            netlifyToken: netlifyToken,
            slug: NEON_DATABASE_EXTENSION_SLUG,
            hostSiteUrl: extension.hostSiteUrl,
        });
        if (!installed) {
            throw new Error(`Failed to install extension on team "${account.name}": "${extension.name}"`);
        }
        log(`Extension "${extension.name}" successfully installed on team "${account.name}"`);
    };
    if (!extension.installedOnTeam) {
        await installNeonExtension();
    }
    if (typeof options.boilerplate === 'string') {
        log(`Initializing ${options.boilerplate}...`);
        await initDrizzle(command);
    }
    log(`Initializing a new database...`);
    const hostSiteUrl = process.env.EXTENSION_HOST_SITE_URL ?? extension.hostSiteUrl;
    const initEndpoint = new URL('/api/cli-db-init', hostSiteUrl).toString();
    const currentUser = await command.netlify.api.getCurrentUser();
    const { data: jigsawToken, error } = await getJigsawToken({
        netlifyToken: netlifyToken,
        accountId: siteInfo.account_id,
        integrationSlug: extension.slug,
    });
    if (error || !jigsawToken) {
        throw new Error(`Failed to get jigsaw token: ${error?.message ?? 'Unknown error'}`);
    }
    const headers = {
        'Content-Type': 'application/json',
        'Nf-UIExt-Netlify-Token': jigsawToken,
        'Nf-UIExt-Netlify-Token-Issuer': 'jigsaw',
        'Nf-UIExt-Extension-Id': extension.id,
        'Nf-UIExt-Extension-Slug': extension.slug,
        'Nf-UIExt-Site-Id': command.siteId ?? '',
        'Nf-UIExt-Team-Id': siteInfo.account_id,
        'Nf-UIExt-User-Id': currentUser.id ?? '',
    };
    const req = await fetch(initEndpoint, {
        method: 'POST',
        headers,
    });
    if (!req.ok) {
        const error = (await req.json());
        if (error.code === 'CONFLICT') {
            log(`Database already connected to this site. Skipping initialization.`);
        }
        else {
            throw new Error(`Failed to initialize DB: ${error.message ?? 'Unknown error occurred'}`);
        }
    }
    let status;
    try {
        const statusEndpoint = new URL('/api/cli-db-status', hostSiteUrl).toString();
        const statusRes = await fetch(statusEndpoint, {
            headers,
        });
        if (!statusRes.ok) {
            throw new Error(`Failed to get database status`, { cause: statusRes });
        }
        status = (await statusRes.json());
    }
    catch (e) {
        console.error('Failed to get database status', e);
    }
    try {
        const packageJson = getPackageJSON(command.workingDir);
        if ((packageJson.dependencies && !Object.keys(packageJson.dependencies).includes(NETLIFY_NEON_PACKAGE_NAME)) ||
            !packageJson.dependencies) {
            await spawnAsync(command.project.packageManager?.installCommand ?? 'npm install', ['@netlify/neon@latest'], {
                stdio: 'inherit',
                shell: true,
            });
        }
    }
    catch (e) {
        console.error(`Failed to install @netlify/neon in ${command.workingDir}:`, e);
    }
    log(prettyjson.render({
        'Current team': account.name,
        'Current site': siteInfo.name,
        [`${extension.name} extension`]: 'installed on team',
        ['Database status']: status?.siteConfiguration?.connectedDatabase?.isConnected
            ? 'connected to site'
            : 'not connected',
        ['Environment variables']: '',
        ['  NETLIFY_DATABASE_URL']: status?.existingManagedEnvs?.includes('NETLIFY_DATABASE_URL') ? 'saved' : 'not set',
        ['  NETLIFY_DATABASE_URL_UNPOOLED']: status?.existingManagedEnvs?.includes('NETLIFY_DATABASE_URL_UNPOOLED')
            ? 'saved'
            : 'not set',
    }));
    return;
};
//# sourceMappingURL=init.js.map