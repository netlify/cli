import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore, type GetStoreOptions } from '@netlify/blobs'

import { chalk, logAndThrowError } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'
import type { BlobsGetOptionValues } from './option_values.js'

export const blobsGet = async (storeName: string, key: string, options: BlobsGetOptionValues, command: BaseCommand) => {
  const { api, siteInfo } = command.netlify
  const { output } = options
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    region: options.region as GetStoreOptions['region'],
    siteID: siteInfo.id,
    token: api.accessToken ?? '',
  })

  let blob

  try {
    blob = await store.get(key, { type: 'arrayBuffer' })
  } catch {
    return logAndThrowError(`Could not retrieve blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- FIXME(@netlify/blobs): `Store.get` overloads omit `null` for missing keys
  if (blob === null) {
    return logAndThrowError(`Blob ${chalk.yellow(key)} does not exist in store ${chalk.yellow(storeName)}`)
  }

  if (output) {
    const path = resolve(output)
    await fs.writeFile(path, Buffer.from(blob))
  } else {
    const decoder = new TextDecoder('utf-8')
    const str = decoder.decode(blob)
    console.log(str)
  }
}
