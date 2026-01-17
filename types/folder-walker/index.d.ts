/// <reference types="node" />
declare module 'folder-walker' {
  import { Stats } from 'fs'
  import { Readable } from 'stream'

  export interface Entry {
    /** file basename */
    basename: string
    /** full path to the file */
    filepath: string
    /** directory where the file is located */
    root: string
    /** relative path to the file from the root */
    relname: string
    /** fs.Stats object */
    stat: Stats
    /** type of file (file, directory, etc) */
    type: string
  }

  export default function walker(
    folders: string | string[],
    options?: {
      filter?: (filename: string, stat: Stats) => boolean
      fs?: any
      maxdepth?: number
    },
  ): Readable
}
