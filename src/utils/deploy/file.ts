import type walker from 'folder-walker'

export type OriginalFile = walker.Entry

export type HashedFile = OriginalFile & { hash: string }

export type File = HashedFile & {
  assetType: 'file'
  normalizedPath: string
}
