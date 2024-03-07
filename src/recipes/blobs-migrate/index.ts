import { getStore, listStores } from '@netlify/blobs'
import inquirer from 'inquirer'
import pMap from 'p-map'

import BaseCommand from '../../commands/base-command.js'
import { error, log } from '../../utils/command-helpers.js'

export const description = 'Migrate legacy Netlify Blobs stores'

const BLOB_OPS_CONCURRENCY = 5

interface Options {
  args: string[]
  command: BaseCommand
}

export const run = async ({ args, command }: Options) => {
  if (args.length !== 1) {
    return error(`Usage: netlify recipes blobs-migrate <name of store>`)
  }

  const [storeName] = args
  const { api, siteInfo } = command.netlify
  const clientOptions = {
    apiURL: `${api.scheme}://${api.host}`,
    siteID: siteInfo?.id ?? '',
    token: api.accessToken ?? '',
  }

  // The store we'll copy from.
  const oldStore = getStore({
    ...clientOptions,
    name: `netlify-internal/legacy-namespace/${storeName}`,
  })

  // The store we'll write to.
  const newStore = getStore({
    ...clientOptions,
    name: storeName,
  })
  const { blobs } = await oldStore.list()

  if (blobs.length === 0) {
    return log(`Store '${storeName}' does not exist or is empty, so there's nothing to migrate.`)
  }

  const { stores } = await listStores(clientOptions)
  const storeExists = stores.some((existingStore) => existingStore === storeName)

  if (storeExists) {
    const { confirmExistingStore } = await inquirer.prompt({
      type: 'confirm',
      name: 'confirmExistingStore',
      message: `The store '${storeName}' already exists in the new format, which means it has already been migrated or it has been used with a newer version of the Netlify Blobs client. If you continue with the migration, any blobs from the legacy store will overwrite newer entries that have the same key. Do you want to proceed?`,
      default: false,
    })

    if (!confirmExistingStore) {
      return
    }
  }

  const { confirmMigration } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirmMigration',
    message: `You're about to migrate the store '${storeName}' with ${blobs.length} blobs. Do you want to proceed?`,
    default: true,
  })

  if (!confirmMigration) {
    return
  }

  await pMap(
    blobs,
    async (blob) => {
      log(`Migrating blob with key '${blob.key}'...`)

      const result = await oldStore.getWithMetadata(blob.key)

      if (result === null) {
        return
      }

      await newStore.set(blob.key, result.data, { metadata: result.metadata })
    },
    { concurrency: BLOB_OPS_CONCURRENCY },
  )

  log('Verifying data in the new store...')

  const { blobs: newBlobs } = await newStore.list()
  const blobsMap = new Map<string, string>(newBlobs.map((blob) => [blob.key, blob.etag]))

  // Before deleting anything, let's first verify that all entries that exist
  // in the old store are now also on the new store, with the same etag.
  if (!blobs.every((blob) => blobsMap.get(blob.key) === blob.etag)) {
    return error(`Failed to migrate some blobs. Try running the command again.`)
  }

  log(`All done! Store '${storeName}' has been migrated.`)

  await pMap(blobs, (blob) => oldStore.delete(blob.key), { concurrency: BLOB_OPS_CONCURRENCY })
}
