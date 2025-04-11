import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore } from '@netlify/blobs'
import { OptionValues } from 'commander'

import { ansis, logAndThrowError } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

interface Options extends OptionValues {
  output?: string
}

export const blobsGet = async (storeName: string, key: string, options: Options, command: BaseCommand) => {
  const { api, siteInfo } = command.netlify
  const { output } = options
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    siteID: siteInfo?.id ?? '',
    token: api.accessToken ?? '',
  })

  let blob: undefined | Awaited<ReturnType<typeof store.get>>

  try {
    blob = await store.get(key)
  } catch {
    return logAndThrowError(`Could not retrieve blob ${ansis.yellow(key)} from store ${ansis.yellow(storeName)}`)
  }

  if (blob === null) {
    return logAndThrowError(`Blob ${ansis.yellow(key)} does not exist in store ${ansis.yellow(storeName)}`)
  }

  if (output) {
    const path = resolve(output)

    await fs.writeFile(path, blob)
  } else {
    console.log(blob)
  }
}
