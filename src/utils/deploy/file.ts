import type { Entry } from 'folder-walker'

export type OriginalFile = Entry

export type File = Entry & {
  hash?: string
  assetType?: string
  normalizedPath: string
}
