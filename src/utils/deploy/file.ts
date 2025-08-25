import walker from 'folder-walker'

export type OriginalFile = walker.Entry

export type File = walker.Entry & {
  hash: string
  assetType: string
  normalizedPath: string
}
