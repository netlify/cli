import { createRequire } from 'module';
import { join } from 'path';
import fsPromises from 'fs/promises';
import fs from 'fs';
import inquirer from 'inquirer';
import { JIGSAW_URL } from './constants.js';
import { spawn } from 'child_process';
export function getPackageJSON(directory) {
    const require = createRequire(join(directory, 'package.json'));
    const packageJson = require('./package.json');
    if (typeof packageJson !== 'object' || packageJson === null) {
        throw new Error('Failed to load package.json');
    }
    if ('dependencies' in packageJson && typeof packageJson.dependencies !== 'object') {
        throw new Error(`Expected object at package.json#dependencies, got ${typeof packageJson.dependencies}`);
    }
    if ('devDependencies' in packageJson && typeof packageJson.devDependencies !== 'object') {
        throw new Error(`Expected object at package.json#devDependencies, got ${typeof packageJson.devDependencies}`);
    }
    if ('scripts' in packageJson && typeof packageJson.scripts !== 'object') {
        throw new Error(`Expected object at package.json#scripts, got ${typeof packageJson.scripts}`);
    }
    return packageJson;
}
export const spawnAsync = (command, args, options) => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options);
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve(code);
            }
            const errorMessage = code ? `Process exited with code ${code.toString()}` : 'Process exited with no code';
            reject(new Error(errorMessage));
        });
    });
};
export const getExtension = async ({ accountId, netlifyToken, slug, }) => {
    const extensionResponse = await fetch(`${JIGSAW_URL}/${encodeURIComponent(accountId)}/integrations/${encodeURIComponent(slug)}`, {
        headers: {
            'netlify-token': netlifyToken,
            'Api-Version': '2',
        },
    });
    if (!extensionResponse.ok) {
        throw new Error(`Failed to fetch extension: ${slug}`);
    }
    const extension = (await extensionResponse.json());
    return extension;
};
export const installExtension = async ({ netlifyToken, accountId, slug, hostSiteUrl, }) => {
    const { data: jigsawToken, error } = await getJigsawToken({
        netlifyToken: netlifyToken,
        accountId,
        integrationSlug: slug,
        isEnable: true,
    });
    if (error || !jigsawToken) {
        throw new Error(`Failed to get Jigsaw token: ${error?.message ?? 'Unknown error'}`);
    }
    const extensionOnInstallUrl = new URL('/.netlify/functions/handler/on-install', hostSiteUrl);
    const installedResponse = await fetch(extensionOnInstallUrl, {
        method: 'POST',
        body: JSON.stringify({
            teamId: accountId,
        }),
        headers: {
            'netlify-token': jigsawToken,
        },
    });
    if (!installedResponse.ok && installedResponse.status !== 409) {
        const text = await installedResponse.text();
        throw new Error(`Failed to install extension '${slug}': ${text}`);
    }
    return true;
};
export const getSiteConfiguration = async ({ siteId, accountId, netlifyToken, slug, }) => {
    const url = new URL(`/team/${accountId}/integrations/${slug}/configuration/site/${siteId}`, JIGSAW_URL);
    const siteConfigurationResponse = await fetch(url.toString(), {
        headers: {
            'netlify-token': netlifyToken,
        },
    });
    if (!siteConfigurationResponse.ok) {
        throw new Error(`Failed to fetch extension site configuration for ${siteId}. Is the extension installed?`);
    }
    const siteConfiguration = await siteConfigurationResponse.json();
    return siteConfiguration;
};
export const carefullyWriteFile = async (filePath, data, projectRoot) => {
    if (fs.existsSync(filePath)) {
        const answers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'overwrite',
                message: `Overwrite existing file .${filePath.replace(projectRoot, '')}?`,
            },
        ]);
        if (answers.overwrite) {
            await fsPromises.writeFile(filePath, data);
        }
    }
    else {
        await fsPromises.writeFile(filePath, data);
    }
};
export const getAccount = async (command, { accountId, }) => {
    let account;
    try {
        // @ts-expect-error -- TODO: fix the getAccount type in the openapi spec. It should not be an array of accounts, just one account.
        account = await command.netlify.api.getAccount({ accountId });
    }
    catch (e) {
        throw new Error(`Error getting account, make sure you are logged in with netlify login`, {
            cause: e,
        });
    }
    if (!account.id || !account.name) {
        throw new Error(`Error getting account, make sure you are logged in with netlify login`);
    }
    return account;
};
export const getJigsawToken = async ({ netlifyToken, accountId, integrationSlug, isEnable, }) => {
    try {
        const tokenResponse = await fetch(`${JIGSAW_URL}/generate-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `_nf-auth=${netlifyToken}`,
                'Api-Version': '2',
            },
            body: JSON.stringify({
                ownerId: accountId,
                integrationSlug,
                isEnable,
            }),
        });
        if (!tokenResponse.ok) {
            return {
                data: null,
                error: {
                    code: 401,
                    message: `Unauthorized`,
                },
            };
        }
        const tokenData = (await tokenResponse.json());
        if (!tokenData?.token) {
            return {
                data: null,
                error: {
                    code: 401,
                    message: `Unauthorized`,
                },
            };
        }
        return {
            data: tokenData.token,
            error: null,
        };
    }
    catch (e) {
        console.error('Failed to get Jigsaw token', e);
        return {
            data: null,
            error: {
                code: 401,
                message: `Unauthorized`,
            },
        };
    }
};
//# sourceMappingURL=utils.js.map