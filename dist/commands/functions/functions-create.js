import cp from 'child_process';
import fs from 'fs';
import { mkdir, readdir, unlink } from 'fs/promises';
import { createRequire } from 'module';
import path, { dirname, join, relative } from 'path';
import process from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import { findUp } from 'find-up';
import fuzzy from 'fuzzy';
import inquirer from 'inquirer';
import fetch from 'node-fetch';
import { createSpinner } from 'nanospinner';
import { fileExistsAsync } from '../../lib/fs.js';
import { getAddons, getCurrentAddon, getSiteData } from '../../utils/addons/prepare.js';
import { NETLIFYDEVERR, NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, logAndThrowError, log, } from '../../utils/command-helpers.js';
import { copyTemplateDir } from '../../utils/copy-template-dir/copy-template-dir.js';
import { getDotEnvVariables, injectEnvVariables } from '../../utils/dev.js';
import execa from '../../utils/execa.js';
import { readRepoURL, validateRepoURL } from '../../utils/read-repo-url.js';
const require = createRequire(import.meta.url);
const templatesDir = path.resolve(dirname(fileURLToPath(import.meta.url)), '../../../functions-templates');
/**
 * Ensure that there's a sub-directory in `/functions-templates` named after
 * each `value` property in this list.
 */
const languages = [
    { name: 'JavaScript', value: 'javascript' },
    { name: 'TypeScript', value: 'typescript' },
    { name: 'Go', value: 'go' },
    { name: 'Rust', value: 'rust' },
];
const MOON_SPINNER = {
    interval: 80,
    frames: ['🌑 ', '🌒 ', '🌓 ', '🌔 ', '🌕 ', '🌖 ', '🌗 ', '🌘 '],
};
/**
 * prompt for a name if name not supplied
 * @param {string} argumentName
 * @param {import('commander').OptionValues} options
 * @param {string} [defaultName]
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'argumentName' implicitly has an 'any' t... Remove this comment to see the full error message
const getNameFromArgs = async function (argumentName, options, defaultName) {
    if (options.name) {
        if (argumentName) {
            throw new Error('function name specified in both flag and arg format, pick one');
        }
        return options.name;
    }
    if (argumentName) {
        return argumentName;
    }
    const { name } = await inquirer.prompt([
        {
            name: 'name',
            message: 'Name your function:',
            default: defaultName,
            type: 'input',
            validate: (val) => Boolean(val) && /^[\w.-]+$/i.test(val),
            // make sure it is not undefined and is a valid filename.
            // this has some nuance i have ignored, eg crossenv and i18n concerns
        },
    ]);
    return name;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'registry' implicitly has an 'any' type.
const filterRegistry = function (registry, input) {
    // @ts-expect-error TS(7006) FIXME: Parameter 'value' implicitly has an 'any' type.
    const temp = registry.map((value) => value.name + value.description);
    const filteredTemplates = fuzzy.filter(input, temp);
    const filteredTemplateNames = new Set(filteredTemplates.map((filteredTemplate) => (input ? filteredTemplate.string : filteredTemplate)));
    return (registry
        // @ts-expect-error TS(7006) FIXME: Parameter 't' implicitly has an 'any' type.
        .filter((t) => filteredTemplateNames.has(t.name + t.description))
        // @ts-expect-error TS(7006) FIXME: Parameter 't' implicitly has an 'any' type.
        .map((t) => {
        // add the score
        // @ts-expect-error TS(2339) FIXME: Property 'score' does not exist on type 'FilterRes... Remove this comment to see the full error message
        const { score } = filteredTemplates.find((filteredTemplate) => filteredTemplate.string === t.name + t.description);
        t.score = score;
        return t;
    }));
};
/**
 * @param {string} lang
 * @param {'edge' | 'serverless'} funcType
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'lang' implicitly has an 'any' type.
const formatRegistryArrayForInquirer = async function (lang, funcType) {
    const folders = await readdir(path.join(templatesDir, lang), { withFileTypes: true });
    const imports = await Promise.all(folders
        .filter((folder) => Boolean(folder?.isDirectory()))
        .map(async ({ name }) => {
        try {
            const templatePath = path.join(templatesDir, lang, name, '.netlify-function-template.mjs');
            // @ts-expect-error TS(7036) FIXME: Dynamic import's specifier must be of type 'string... Remove this comment to see the full error message
            const template = await import(pathToFileURL(templatePath));
            return template.default;
        }
        catch {
            // noop if import fails we don't break the whole inquirer
        }
    }));
    const registry = imports
        .filter((template) => template?.functionType === funcType)
        .sort((templateA, templateB) => {
        const priorityDiff = (templateA.priority || DEFAULT_PRIORITY) - (templateB.priority || DEFAULT_PRIORITY);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }
        // This branch is needed because `Array.prototype.sort` was not stable
        // until Node 11, so the original sorting order from `fs.readdirSync`
        // was not respected. We can simplify this once we drop support for
        // Node 10.
        return templateA - templateB;
    })
        .map((t) => {
        t.lang = lang;
        return {
            // confusing but this is the format inquirer wants
            name: `[${t.name}] ${t.description}`,
            value: t,
            short: `${lang}-${t.name}`,
        };
    });
    return registry;
};
/**
 * pick template from our existing templates
 * @param {import('commander').OptionValues} config
 * @param {'edge' | 'serverless'} funcType
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'languageFromFlag' implicitly has ... Remove this comment to see the full error message
const pickTemplate = async function ({ language: languageFromFlag }, funcType) {
    const specialCommands = [
        new inquirer.Separator(),
        {
            name: `Clone template from GitHub URL`,
            value: 'url',
            short: 'gh-url',
        },
        {
            name: `Report issue with, or suggest a new template`,
            value: 'report',
            short: 'gh-report',
        },
        new inquirer.Separator(),
    ];
    let language = languageFromFlag;
    if (language === undefined) {
        const langs = funcType === 'edge'
            ? languages.filter((lang) => lang.value === 'javascript' || lang.value === 'typescript')
            : languages.filter(Boolean);
        const { language: languageFromPrompt } = await inquirer.prompt({
            choices: langs,
            message: 'Select the language of your function',
            name: 'language',
            type: 'list',
        });
        language = languageFromPrompt;
    }
    let templatesForLanguage;
    try {
        templatesForLanguage = await formatRegistryArrayForInquirer(language, funcType);
    }
    catch {
        return logAndThrowError(`Invalid language: ${language}`);
    }
    const { chosenTemplate } = await inquirer.prompt({
        name: 'chosenTemplate',
        message: 'Pick a template',
        // @ts-expect-error TS(2769) FIXME: No overload matches this call.
        type: 'autocomplete',
        source(_answersSoFar, input) {
            // if Edge Functions template, don't show url option
            // @ts-expect-error TS(2339) FIXME: Property 'value' does not exist on type 'Separator... Remove this comment to see the full error message
            const edgeCommands = specialCommands.filter((val) => val.value !== 'url');
            const parsedSpecialCommands = funcType === 'edge' ? edgeCommands : specialCommands;
            if (!input || input === '') {
                // show separators
                return [...templatesForLanguage, ...parsedSpecialCommands];
            }
            // only show filtered results sorted by score
            const answers = [...filterRegistry(templatesForLanguage, input), ...parsedSpecialCommands].sort((answerA, answerB) => answerB.score - answerA.score);
            return answers;
        },
    });
    return chosenTemplate;
};
const DEFAULT_PRIORITY = 999;
const selectTypeOfFunc = async () => {
    const functionTypes = [
        { name: 'Edge function (Deno)', value: 'edge' },
        { name: 'Serverless function (Node/Go/Rust)', value: 'serverless' },
    ];
    const { functionType } = await inquirer.prompt([
        {
            name: 'functionType',
            message: "Select the type of function you'd like to create",
            type: 'list',
            choices: functionTypes,
        },
    ]);
    return functionType;
};
/**
 * @param {import('../base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const ensureEdgeFuncDirExists = function (command) {
    const { config, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        return logAndThrowError(`${NETLIFYDEVERR} No project id found, please run inside a project directory or \`netlify link\``);
    }
    const functionsDir = config.build?.edge_functions ?? join(command.workingDir, 'netlify/edge-functions');
    const relFunctionsDir = relative(command.workingDir, functionsDir);
    if (!fs.existsSync(functionsDir)) {
        log(`${NETLIFYDEVLOG} Edge Functions directory ${chalk.magenta.inverse(relFunctionsDir)} does not exist yet, creating it...`);
        fs.mkdirSync(functionsDir, { recursive: true });
        log(`${NETLIFYDEVLOG} Edge Functions directory ${chalk.magenta.inverse(relFunctionsDir)} created.`);
    }
    return functionsDir;
};
/**
 * Prompts the user to choose a functions directory
 * @param {import('../base-command.js').default} command
 * @returns {Promise<string>} - functions directory or throws an error
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const promptFunctionsDirectory = async (command) => {
    const { api, relConfigFilePath, site } = command.netlify;
    log(`\n${NETLIFYDEVLOG} functions directory not specified in ${relConfigFilePath} or UI settings`);
    if (!site.id) {
        return logAndThrowError(`${NETLIFYDEVERR} No project id found, please run inside a project directory or \`netlify link\``);
    }
    const { functionsDir } = await inquirer.prompt([
        {
            type: 'input',
            name: 'functionsDir',
            message: 'Enter the path, relative to your project, where your functions should live:',
            default: 'netlify/functions',
        },
    ]);
    try {
        log(`${NETLIFYDEVLOG} updating project settings with ${chalk.magenta.inverse(functionsDir)}`);
        await api.updateSite({
            siteId: site.id,
            body: {
                build_settings: {
                    functions_dir: functionsDir,
                },
            },
        });
        log(`${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(functionsDir)} updated in project settings`);
    }
    catch {
        return logAndThrowError('Error updating project settings');
    }
    return functionsDir;
};
/**
 * Get functions directory (and make it if necessary)
 * @param {import('../base-command.js').default} command
 * @returns {Promise<string>} - functions directory or throws an error
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const ensureFunctionDirExists = async function (command) {
    const { config } = command.netlify;
    const functionsDirHolder = config.functionsDirectory || join(command.workingDir, await promptFunctionsDirectory(command));
    const relFunctionsDirHolder = relative(command.workingDir, functionsDirHolder);
    if (!fs.existsSync(functionsDirHolder)) {
        log(`${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(relFunctionsDirHolder)} does not exist yet, creating it...`);
        await mkdir(functionsDirHolder, { recursive: true });
        log(`${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(relFunctionsDirHolder)} created`);
    }
    return functionsDirHolder;
};
/**
 * Download files from a given GitHub URL
 * @param {import('../base-command.js').default} command
 * @param {import('commander').OptionValues} options
 * @param {string} argumentName
 * @param {string} functionsDir
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const downloadFromURL = async function (command, options, argumentName, functionsDir) {
    const folderContents = await readRepoURL(options.url);
    const [functionName] = options.url.split('/').slice(-1);
    const nameToUse = await getNameFromArgs(argumentName, options, functionName);
    const fnFolder = path.join(functionsDir, nameToUse);
    if (fs.existsSync(`${fnFolder}.js`) && fs.lstatSync(`${fnFolder}.js`).isFile()) {
        log(`${NETLIFYDEVWARN}: A single file version of the function ${nameToUse} already exists at ${fnFolder}.js. Terminating without further action.`);
        process.exit(1);
    }
    try {
        await mkdir(fnFolder, { recursive: true });
    }
    catch {
        // Ignore
    }
    await Promise.all(
    // @ts-expect-error TS(7031) FIXME: Binding element 'downloadUrl' implicitly has an 'a... Remove this comment to see the full error message
    folderContents.map(async ({ download_url: downloadUrl, name }) => {
        try {
            const res = await fetch(downloadUrl);
            const finalName = path.basename(name, '.js') === functionName ? `${nameToUse}.js` : name;
            const dest = fs.createWriteStream(path.join(fnFolder, finalName));
            res.body?.pipe(dest);
        }
        catch (error_) {
            throw new Error(`Error while retrieving ${downloadUrl} ${error_}`);
        }
    }));
    log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse}...`);
    cp.exec('npm i', { cwd: path.join(functionsDir, nameToUse) }, () => {
        log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse} complete `);
    });
    // read, execute, and delete function template file if exists
    const fnTemplateFile = path.join(fnFolder, '.netlify-function-template.mjs');
    if (await fileExistsAsync(fnTemplateFile)) {
        const { default: { addons = [], onComplete }, } = await import(pathToFileURL(fnTemplateFile).href);
        await installAddons(command, addons, path.resolve(fnFolder));
        await handleOnComplete({ command, onComplete });
        // delete
        await unlink(fnTemplateFile);
    }
};
/**
 * Takes a list of existing packages and a list of packages required by a
 * function, and returns the packages from the latter that aren't present
 * in the former. The packages are returned as an array of strings with the
 * name and version range (e.g. '@netlify/functions@0.1.0').
 */
const getNpmInstallPackages = (existingPackages = {}, neededPackages = {}) => Object.entries(neededPackages)
    // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    .filter(([name]) => existingPackages[name] === undefined)
    .map(([name, version]) => `${name}@${version}`);
/**
 * When installing a function's dependencies, we first try to find a project-level
 * `package.json` file. If we find one, we identify the function's dependencies
 * that aren't already listed as dependencies of the project and install them. If
 * we don't do this check, we may be upgrading the version of a module used in
 * another part of the project, which we don't want to do.
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'functionPackageJson' implicitly h... Remove this comment to see the full error message
const installDeps = async ({ functionPackageJson, functionPath, functionsDir }) => {
    const { dependencies: functionDependencies, devDependencies: functionDevDependencies } = require(functionPackageJson);
    const sitePackageJson = await findUp('package.json', { cwd: functionsDir });
    const npmInstallFlags = ['--no-audit', '--no-fund'];
    // If there is no project-level `package.json`, we fall back to the old behavior
    // of keeping that file in the function directory and running `npm install`
    // from there.
    if (!sitePackageJson) {
        await execa('npm', ['i', ...npmInstallFlags], { cwd: functionPath });
        return;
    }
    const { dependencies: siteDependencies, devDependencies: siteDevDependencies } = require(sitePackageJson);
    const dependencies = getNpmInstallPackages(siteDependencies, functionDependencies);
    const devDependencies = getNpmInstallPackages(siteDevDependencies, functionDevDependencies);
    const npmInstallPath = path.dirname(sitePackageJson);
    if (dependencies.length !== 0) {
        await execa('npm', ['i', ...dependencies, '--save', ...npmInstallFlags], { cwd: npmInstallPath });
    }
    if (devDependencies.length !== 0) {
        await execa('npm', ['i', ...devDependencies, '--save-dev', ...npmInstallFlags], { cwd: npmInstallPath });
    }
    // We installed the function's dependencies in the project-level `package.json`,
    // so there's no reason to keep the one copied over from the template.
    fs.unlinkSync(functionPackageJson);
    // Similarly, if the template has a `package-lock.json` file, we delete it.
    try {
        const functionPackageLock = path.join(functionPath, 'package-lock.json');
        fs.unlinkSync(functionPackageLock);
    }
    catch {
        // no-op
    }
};
/**
 * no --url flag specified, pick from a provided template
 * @param {import('../base-command.js').default} command
 * @param {import('commander').OptionValues} options
 * @param {string} argumentName
 * @param {string} functionsDir Absolute path of the functions directory
 * @param {'edge' | 'serverless'} funcType
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const scaffoldFromTemplate = async function (command, options, argumentName, functionsDir, funcType) {
    // pull the rest of the metadata from the template
    const chosenTemplate = await pickTemplate(options, funcType);
    if (chosenTemplate === 'url') {
        const { chosenUrl } = await inquirer.prompt([
            {
                name: 'chosenUrl',
                message: 'URL to clone: ',
                type: 'input',
                validate: (/** @type {string} */ val) => Boolean(validateRepoURL(val)),
                // make sure it is not undefined and is a valid filename.
                // this has some nuance i have ignored, eg crossenv and i18n concerns
            },
        ]);
        options.url = chosenUrl.trim();
        try {
            await downloadFromURL(command, options, argumentName, functionsDir);
        }
        catch {
            return logAndThrowError(`$${NETLIFYDEVERR} Error downloading from URL: ${options.url}`);
        }
    }
    else if (chosenTemplate === 'report') {
        log(`${NETLIFYDEVLOG} Open in browser: https://github.com/netlify/cli/issues/new`);
    }
    else {
        const { addons = [], lang, name: templateName, onComplete } = chosenTemplate;
        const pathToTemplate = path.join(templatesDir, lang, templateName);
        if (!fs.existsSync(pathToTemplate)) {
            throw new Error(`There isn't a corresponding directory to the selected name. Template '${templateName}' is misconfigured`);
        }
        const name = await getNameFromArgs(argumentName, options, templateName);
        log(`${NETLIFYDEVLOG} Creating function ${chalk.cyan.inverse(name)}`);
        const functionPath = ensureFunctionPathIsOk(functionsDir, name);
        const vars = { name };
        let functionPackageJson;
        // These files will not be part of the log message because they'll likely
        // be removed before the command finishes.
        const omittedFromOutput = new Set(['.netlify-function-template.mjs', 'package.json', 'package-lock.json']);
        const createdFiles = await copyTemplateDir(pathToTemplate, functionPath, vars);
        createdFiles.forEach((filePath) => {
            const filename = path.basename(filePath);
            if (!omittedFromOutput.has(filename)) {
                log(`${NETLIFYDEVLOG} ${chalk.greenBright('Created')} ${filePath}`);
            }
            fs.chmodSync(path.resolve(filePath), TEMPLATE_PERMISSIONS);
            if (filePath.includes('package.json')) {
                functionPackageJson = path.resolve(filePath);
            }
        });
        // delete function template file that was copied over by copydir
        await unlink(path.join(functionPath, '.netlify-function-template.mjs'));
        // npm install
        if (functionPackageJson !== undefined) {
            const spinner = createSpinner(`Installing dependencies for ${name}`, MOON_SPINNER).start();
            await installDeps({ functionPackageJson, functionPath, functionsDir });
            spinner.success(`Installed dependencies for ${name}`);
        }
        if (funcType === 'edge') {
            await registerEFInToml(name, command.netlify);
        }
        await installAddons(command, addons, path.resolve(functionPath));
        await handleOnComplete({ command, onComplete });
        log();
        log(chalk.greenBright(`Function created!`));
        if (lang == 'rust') {
            log(chalk.green(`Please note that Rust functions require setting the NETLIFY_EXPERIMENTAL_BUILD_RUST_SOURCE environment variable to 'true' on your project.`));
        }
    }
};
const TEMPLATE_PERMISSIONS = 0o777;
// @ts-expect-error TS(7031) FIXME: Binding element 'addonName' implicitly has an 'any... Remove this comment to see the full error message
const createFunctionAddon = async function ({ addonName, addons, api, siteData, siteId }) {
    try {
        const addon = getCurrentAddon({ addons, addonName });
        if (addon && addon.id) {
            log(`The "${addonName} add-on" already exists for ${siteData.name}`);
            return false;
        }
        await api.createServiceInstance({
            siteId,
            addon: addonName,
            body: { config: {} },
        });
        log(`Add-on "${addonName}" created for ${siteData.name}`);
        return true;
    }
    catch (error_) {
        return logAndThrowError(error_.message);
    }
};
/**
 *
 * @param {object} config
 * @param {import('../base-command.js').default} config.command
 * @param {(command: import('../base-command.js').default) => any} config.onComplete
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'command' implicitly has an 'any' ... Remove this comment to see the full error message
const handleOnComplete = async ({ command, onComplete }) => {
    const { config } = command.netlify;
    if (onComplete) {
        const env = await getDotEnvVariables({
            devConfig: { ...config.dev },
            env: command.netlify.cachedConfig.env,
            site: command.netlify.site,
        });
        injectEnvVariables(env);
        await onComplete.call(command);
    }
};
/**
 *
 * @param {object} config
 * @param {*} config.addonCreated
 * @param {*} config.addonDidInstall
 * @param {import('../base-command.js').default} config.command
 * @param {string} config.fnPath
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'addonCreated' implicitly has an '... Remove this comment to see the full error message
const handleAddonDidInstall = async ({ addonCreated, addonDidInstall, command, fnPath }) => {
    const { config } = command.netlify;
    if (!addonCreated || !addonDidInstall) {
        return;
    }
    const { confirmPostInstall } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmPostInstall',
            message: `This template has an optional setup script that runs after addon install. This can be helpful for first time users to try out templates. Run the script?`,
            default: false,
        },
    ]);
    if (!confirmPostInstall) {
        return;
    }
    await injectEnvVariables({
        devConfig: { ...config.dev },
        env: command.netlify.cachedConfig.env,
        site: command.netlify.site,
    });
    addonDidInstall(fnPath);
};
/**
 *
 * @param {import('../base-command.js').default} command
 * @param {*} functionAddons
 * @param {*} fnPath
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const installAddons = async function (command, functionAddons, fnPath) {
    if (functionAddons.length === 0) {
        return;
    }
    const { api, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No project id found, please run inside a project directory or `netlify link`');
        return false;
    }
    log(`${NETLIFYDEVLOG} checking Netlify APIs...`);
    const [siteData, siteAddons] = await Promise.all([getSiteData({ api, siteId }), getAddons({ api, siteId })]);
    // @ts-expect-error TS(7031) FIXME: Binding element 'addonDidInstall' implicitly has a... Remove this comment to see the full error message
    const arr = functionAddons.map(async ({ addonDidInstall, addonName }) => {
        log(`${NETLIFYDEVLOG} installing addon: ${chalk.yellow.inverse(addonName)}`);
        try {
            const addonCreated = await createFunctionAddon({
                api,
                addons: siteAddons,
                siteId,
                addonName,
                siteData,
            });
            await handleAddonDidInstall({ addonCreated, addonDidInstall, command, fnPath });
        }
        catch (error_) {
            return logAndThrowError(`${NETLIFYDEVERR} Error installing addon: ${error_}`);
        }
    });
    return Promise.all(arr);
};
/**
 *
 * @param {string} funcName
 * @param {import('../types.js').NetlifyOptions} options
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'funcName' implicitly has an 'any' type.
const registerEFInToml = async (funcName, options) => {
    const { configFilePath, relConfigFilePath } = options;
    if (!fs.existsSync(configFilePath)) {
        log(`${NETLIFYDEVLOG} \`${relConfigFilePath}\` file does not exist yet. Creating it...`);
    }
    let { funcPath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'funcPath',
            message: `What route do you want your edge function to be invoked on?`,
            default: '/test',
            validate: (val) => Boolean(val),
            // Make sure route isn't undefined and is valid
            // Todo: add more validation?
        },
    ]);
    // Make sure path begins with a '/'
    if (funcPath[0] !== '/') {
        funcPath = `/${funcPath}`;
    }
    const functionRegister = `\n\n[[edge_functions]]\nfunction = "${funcName}"\npath = "${funcPath}"`;
    try {
        fs.promises.appendFile(configFilePath, functionRegister);
        log(`${NETLIFYDEVLOG} Function '${funcName}' registered for route \`${funcPath}\`. To change, edit your \`${relConfigFilePath}\` file.`);
    }
    catch {
        return logAndThrowError(`${NETLIFYDEVERR} Unable to register function. Please check your \`${relConfigFilePath}\` file.`);
    }
};
/**
 * we used to allow for a --dir command,
 * but have retired that to force every scaffolded function to be a directory
 * @param {string} functionsDir
 * @param {string} name
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'functionsDir' implicitly has an 'any' t... Remove this comment to see the full error message
const ensureFunctionPathIsOk = function (functionsDir, name) {
    const functionPath = path.join(functionsDir, name);
    if (fs.existsSync(functionPath)) {
        log(`${NETLIFYDEVLOG} Function ${functionPath} already exists, cancelling...`);
        process.exit(1);
    }
    return functionPath;
};
export const functionsCreate = async (name, options, command) => {
    const functionType = await selectTypeOfFunc();
    const functionsDir = functionType === 'edge' ? await ensureEdgeFuncDirExists(command) : await ensureFunctionDirExists(command);
    /* either download from URL or scaffold from template */
    const mainFunc = options.url ? downloadFromURL : scaffoldFromTemplate;
    await mainFunc(command, options, name, functionsDir, functionType);
};
//# sourceMappingURL=functions-create.js.map