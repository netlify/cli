import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore, type GetStoreOptions } from '@netlify/blobs'
import type { OptionValues } from 'commander'

import { chalk, logAndThrowError } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

interface Options extends OptionValues {
  output?: string
  region?: GetStoreOptions['region']
}

export const blobsGet = async (storeName: string, key: string, options: Options, command: BaseCommand) => {
  const { api, siteInfo } = command.netlify
  const { output } = options
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    region: options.region,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- FIXME: `siteInfo` and its `id` are typed as always set
    siteID: siteInfo?.id ?? '',
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
