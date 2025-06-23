import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import { dirname, posix, relative } from 'path';
import * as JSONC from 'comment-json';
const toUnixPath = (path) => path.replace(/\\/g, '/');
// @ts-expect-error TS(7006) FIXME: Parameter 'existingSettings' implicitly has an 'an... Remove this comment to see the full error message
export const applySettings = (existingSettings, { denoBinary, edgeFunctionsPath, repositoryRoot }) => {
    // TODO(serhalp): I'm not convinced we want to convert to Unix paths on Windows? Does this even work? Was this a
    // workaround for something, perhaps https://github.com/denoland/vscode_deno/pull/745?
    const relativeEdgeFunctionsPath = toUnixPath(posix.normalize(relative(repositoryRoot, edgeFunctionsPath)));
    const settings = JSONC.assign(existingSettings, {
        'deno.enable': true,
        'deno.enablePaths': existingSettings['deno.enablePaths'] || [],
        'deno.unstable': true,
        'deno.importMap': '.netlify/edge-functions-import-map.json',
    });
    // If the Edge Functions path isn't already in `deno.enabledPaths`, let's add
    // it.
    if (!settings['deno.enablePaths'].includes(relativeEdgeFunctionsPath)) {
        settings['deno.enablePaths'].push(relativeEdgeFunctionsPath);
    }
    // If the Deno CLI binary isn't globally installed, we need to set the path
    // to it in the settings file or the extension won't know where to find it.
    // The only exception is when `deno.path` has already been defined, because
    // we don't want to override that.
    if (!denoBinary.global && settings['deno.path'] === undefined) {
        settings['deno.path'] = denoBinary.path;
    }
    return settings;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'settingsPath' implicitly has an 'any' t... Remove this comment to see the full error message
export const getSettings = async (settingsPath) => {
    try {
        const stats = await stat(settingsPath);
        if (!stats.isFile()) {
            throw new Error(`${settingsPath} is not a valid file.`);
        }
        const file = await readFile(settingsPath, 'utf8');
        return {
            fileExists: true,
            settings: JSONC.parse(file),
        };
    }
    catch (error) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error.code !== 'ENOENT') {
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            throw new Error(`Could not open VS Code settings file: ${error.message}`);
        }
        return {
            fileExists: false,
            settings: {},
        };
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
export const writeSettings = async ({ settings, settingsPath }) => {
    const serializedSettings = JSONC.stringify(settings, null, 2);
    await mkdir(dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, serializedSettings);
};
//# sourceMappingURL=settings.js.map