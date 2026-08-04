import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'

import type { Manifest } from '@netlify/edge-bundler'

import type { StatusCallback } from './status-cb.js'
import type { EdgeFunctionUploadFile } from './upload-files.js'

const hashBundle = async (filepath: string, hashAlgorithm: string): Promise<string> => {
  const hasher = createHash(hashAlgorithm)
  await pipeline([createReadStream(filepath), hasher])
  return hasher.digest('hex')
}

// Reads the edge-bundler manifest from the dist directory and, for every bundle, computes its
// `code_sha` (sha256 of the bundle bytes — the deploy identity, recomputed rather than trusting the
// bundler's asset filename) so we can both declare it on deploy create and stream it on upload. We
// declare every format; bitballoon decides which ones actually ride this path and returns them in
// `required_edge_functions`.
const hashEdgeFunctions = async (
  edgeFunctionsDistPath: string | undefined,
  { hashAlgorithm = 'sha256', statusCb }: { hashAlgorithm?: string; statusCb: StatusCallback },
): Promise<{
  // edge_functions: { format => code_sha } sent on deploy create
  edgeFunctions: Record<string, string>
  // code_sha => [fileObj] consumed by the upload arm
  edgeFnShaMap: Record<string, EdgeFunctionUploadFile[]>
}> => {
  const edgeFunctions: Record<string, string> = {}
  const edgeFnShaMap: Record<string, EdgeFunctionUploadFile[]> = {}

  if (!edgeFunctionsDistPath) {
    return { edgeFunctions, edgeFnShaMap }
  }

  // `Partial` because this is whatever happens to be on disk, not something we produced.
  let manifest: Partial<Manifest>
  try {
    manifest = JSON.parse(await readFile(join(edgeFunctionsDistPath, 'manifest.json'), 'utf8')) as Partial<Manifest>
  } catch {
    // No manifest (or an unreadable one) means there are no edge functions to declare.
    return { edgeFunctions, edgeFnShaMap }
  }

  const bundles = manifest.bundles ?? []
  for (const bundle of bundles) {
    const filepath = join(edgeFunctionsDistPath, bundle.asset)
    const codeSha = await hashBundle(filepath, hashAlgorithm)

    edgeFunctions[bundle.format] = codeSha

    const fileObj: EdgeFunctionUploadFile = {
      assetType: 'edge-function',
      filepath,
      normalizedPath: codeSha,
      hash: codeSha,
    }
    if (Array.isArray(edgeFnShaMap[codeSha])) {
      edgeFnShaMap[codeSha].push(fileObj)
    } else {
      edgeFnShaMap[codeSha] = [fileObj]
    }

    statusCb({ type: 'hashing', msg: `Hashing edge function bundle ${bundle.asset}`, phase: 'progress' })
  }

  return { edgeFunctions, edgeFnShaMap }
}

export default hashEdgeFunctions
