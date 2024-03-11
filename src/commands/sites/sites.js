import { InvalidArgumentError } from 'commander';
const MAX_SITE_NAME_LENGTH = 63;
// @ts-expect-error TS(7006) FIXME: Parameter 'value' implicitly has an 'any' type.
const validateName = function (value) {
    // netlify sites:create --name <A string of more than 63 words>
    if (typeof value === 'string' && value.length > MAX_SITE_NAME_LENGTH) {
        throw new InvalidArgumentError(`--name should be less than 64 characters, input length: ${value.length}`);
    }
    return value;
};
const sites = (options, command) => {
    command.help();
};
export const createSitesFromTemplateCommand = (program) => {
    program
        .command('sites:create-template')
        .description(`(Beta) Create a site from a starter template
Create a site from a starter template.`)
        .option('-n, --name [name]', 'name of site')
        .option('-u, --url [url]', 'template url')
        .option('-a, --account-slug [slug]', 'account slug to create the site under')
        .option('-c, --with-ci', 'initialize CI hooks during site creation')
        .argument('[repository]', 'repository to use as starter template')
        .addHelpText('after', `(Beta) Create a site from starter template.`)
        .addExamples([
        'netlify sites:create-template',
        'netlify sites:create-template nextjs-blog-theme',
        'netlify sites:create-template my-github-profile/my-template',
    ])
        .action(async (repository, options, command) => {
        const { sitesCreateTemplate } = await import('./sites-create-template.js');
        await sitesCreateTemplate(repository, options, command);
    });
};
export const createSitesCreateCommand = (program) => {
    program
        .command('sites:create')
        .description(`Create an empty site (advanced)
Create a blank site that isn't associated with any git remote. Will link the site to the current working directory.`)
        .option('-n, --name <name>', 'name of site', validateName)
        .option('-a, --account-slug <slug>', 'account slug to create the site under')
        .option('-c, --with-ci', 'initialize CI hooks during site creation')
        .option('-m, --manual', 'force manual CI setup.  Used --with-ci flag')
        .option('--disable-linking', 'create the site without linking it to current directory')
        .addHelpText('after', `Create a blank site that isn't associated with any git remote. Will link the site to the current working directory.`)
        .action(async (options, command) => {
        const { sitesCreate } = await import('./sites-create.js');
        await sitesCreate(options, command);
    });
};
export const createSitesCommand = (program) => {
    createSitesCreateCommand(program);
    createSitesFromTemplateCommand(program);
    program
        .command('sites:list')
        .description('List all sites you have access to')
        .option('--json', 'Output site data as JSON')
        .action(async (options, command) => {
        const { sitesList } = await import('./sites-list.js');
        await sitesList(options, command);
    });
    program
        .command('sites:delete')
        .description('Delete a site\nThis command will permanently delete the site on Netlify. Use with caution.')
        .argument('<siteId>', 'Site ID to delete.')
        .option('-f, --force', 'delete without prompting (useful for CI)')
        .addExamples(['netlify sites:delete 1234-3262-1211'])
        .action(async (siteId, options, command) => {
        const { sitesDelete } = await import('./sites-delete.js');
        await sitesDelete(siteId, options, command);
    });
    return program
        .command('sites')
        .description(`Handle various site operations\nThe sites command will help you manage all your sites`)
        .addExamples(['netlify sites:create --name my-new-site', 'netlify sites:list'])
        .action(sites);
};
