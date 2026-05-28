import StreamZipModule from 'node-stream-zip'

const { async: StreamZipAsync } = StreamZipModule

/**
 * Extracts a zip file to a target directory. Drop-in replacement for the
 * unmaintained `extract-zip` package, which hangs on Node 24 because its
 * stream.pipeline usage no longer terminates.
 */
export const extractZip = async (zipPath: string, { dir }: { dir: string }): Promise<void> => {
  const zip = new StreamZipAsync({ file: zipPath })
  try {
    await zip.extract(null, dir)
  } finally {
    await zip.close()
  }
}
