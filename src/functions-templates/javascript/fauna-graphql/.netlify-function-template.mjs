import execa from 'execa'

export default {
  name: 'fauna-graphql',
  description: 'GraphQL Backend using Fauna DB',
  functionType: 'serverless',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        execa.sync(fnPath + '/sync-schema.js', undefined, {
          stdio: 'inherit',
        })
      },
    },
  ],
}
