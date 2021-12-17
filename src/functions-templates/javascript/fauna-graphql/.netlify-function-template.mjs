import { execaSync } from 'execa'

export default {
  name: 'fauna-graphql',
  description: 'GraphQL Backend using Fauna DB',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        execaSync(fnPath + '/sync-schema.js', undefined, {
          stdio: 'inherit',
        })
      },
    },
  ],
}
