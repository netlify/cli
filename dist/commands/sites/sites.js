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
const sites = (_options, command) => {
    command.help();
};
export const createSitesFromTemplateCommand = (program) => {
    program
        .command('sites:create-template')
        .description(`(Beta) Create a project from a starter template
Create a project from a starter template.`)
        .option('-n, --name [name]', 'name of project')
        .option('-u, --url [url]', 'template url')
        .option('-a, --account-slug [slug]', 'account slug to create the project under')
        .option('-c, --with-ci', 'initialize CI hooks during project creation')
        .argument('[repository]', 'repository to use as starter template')
        .addHelpText('after', `(Beta) Create a project from starter template.`)
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
        .description(`Create an empty project (advanced)
Create a blank project that isn't associated with any git remote. Will link the project to the current working directory.`)
        .option('-n, --name <name>', 'name of project', validateName)
        .option('-a, --account-slug <slug>', 'account slug to create the project under')
        .option('-c, --with-ci', 'initialize CI hooks during project creation')
        .option('-m, --manual', 'force manual CI setup.  Used --with-ci flag')
        .option('--disable-linking', 'create the project without linking it to current directory')
        .addHelpText('after', `Create a blank project that isn't associated with any git remote. Will link the project to the current working directory.`)
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
        .description('List all projects you have access to')
        .option('--json', 'Output project data as JSON')
        .action(async (options, command) => {
        const { sitesList } = await import('./sites-list.js');
        await sitesList(options, command);
    });
    program
        .command('sites:delete')
        .description('Delete a project\nThis command will permanently delete the project on Netlify. Use with caution.')
        .argument('<id>', 'Project ID to delete.')
        .addExamples(['netlify sites:delete 1234-3262-1211'])
        .action(async (siteId, options, command) => {
        const { sitesDelete } = await import('./sites-delete.js');
        await sitesDelete(siteId, options, command);
    });
    return program
        .command('sites')
        .description(`Handle various project operations\nThe sites command will help you manage all your projects`)
        .addExamples(['netlify sites:create --name my-new-project', 'netlify sites:list'])
        .action(sites);
};
//# sourceMappingURL=sites.js.map