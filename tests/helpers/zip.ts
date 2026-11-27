import { crc32, deflateRawSync } from 'node:zlib'

type ZipEntry = {
  name: string
  contents?: string | Buffer
  mode?: number
  deflate?: boolean
  uncompressedSize?: number
}

// Build the headers directly so malformed entries and duplicate names survive fixture creation.
export const createZip = (entries: ZipEntry[]): Buffer => {
  const files: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name)
    const contents = Buffer.from(entry.contents ?? '')
    const compressed = entry.deflate ? deflateRawSync(contents) : contents
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8)
    local.writeUInt32LE(crc32(contents), 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(entry.uncompressedSize ?? contents.length, 22)
    local.writeUInt16LE(name.length, 26)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(0x314, 4)
    local.copy(central, 6, 4, 30)
    central.writeUInt32LE(((entry.mode ?? 0) * 0x10000) >>> 0, 38)
    central.writeUInt32LE(offset, 42)

    files.push(local, name, compressed)
    directory.push(central, name)
    offset += local.length + name.length + compressed.length
  }

  const centralDirectory = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)

  return Buffer.concat([...files, centralDirectory, end])
}
