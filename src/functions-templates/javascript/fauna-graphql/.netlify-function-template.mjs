import { sync } from 'execa'

export const config = {
  name: 'fauna-graphql',
  description: 'GraphQL Backend using Fauna DB',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        sync(fnPath + '/sync-schema.js', undefined, {
          stdio: 'inherit',
        })
      },
    },
  ],
}
