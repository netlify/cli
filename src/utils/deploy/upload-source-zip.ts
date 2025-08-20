import { execFile } from 'child_process'
import { readFile, stat } from 'fs/promises'
import { join, relative } from 'path'
import { promisify } from 'util'
import type { PathLike } from 'fs'

import fetch from 'node-fetch'

import { log, warn } from '../command-helpers.js'
import { temporaryDirectory } from '../temporary-file.js'
import type { DeployEvent } from './status-cb.js'

const execFileAsync = promisify(execFile)

interface UploadSourceZipOptions {
  sourceDir: string
  uploadUrl: string
  filename: string
  statusCb?: (status: DeployEvent) => void
}

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.netlify',
  '.next',
  'dist',
  'build',
  '.nuxt',
  '.output',
  '.vercel',
  '__pycache__',
  '.venv',
  '.env',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '.nyc_output',
  'coverage',
  '.cache',
  '.tmp',
  '.temp',
]

const createSourceZip = async (sourceDir: string, statusCb: (status: DeployEvent) => void) => {
  const tmpDir = temporaryDirectory()
  const zipPath = join(tmpDir, 'source.zip')

  statusCb({
    type: 'source-zip-upload',
    msg: `Creating source zip...`,
    phase: 'start',
  })

  // Create exclusion list for zip command
  const excludeArgs = DEFAULT_IGNORE_PATTERNS.flatMap((pattern) => ['-x', pattern])

  // Use system zip command to create the archive
  await execFileAsync('zip', ['-r', zipPath, '.', ...excludeArgs], {
    cwd: sourceDir,
    maxBuffer: 1024 * 1024 * 100, // 100MB buffer
  })

  return zipPath
}

const uploadZipToS3 = async (zipPath: string, uploadUrl: string, statusCb: (status: DeployEvent) => void): Promise<void> => {
  const zipBuffer = await readFile(zipPath)
  const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(2)
  
  statusCb({
    type: 'source-zip-upload',
    msg: `Uploading source zip (${sizeMB} MB)...`,
    phase: 'progress',
  })

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: zipBuffer,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': zipBuffer.length.toString(),
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to upload zip: ${response.status} ${response.statusText}`)
  }
}

export const uploadSourceZip = async ({
  sourceDir,
  uploadUrl,
  filename,
  statusCb = () => {},
}: UploadSourceZipOptions): Promise<void> => {
  let zipPath: PathLike | undefined

  try {
    // Create zip from source directory
    zipPath = await createSourceZip(sourceDir, statusCb)

    // Upload to S3
    await uploadZipToS3(zipPath, uploadUrl, statusCb)

    statusCb({
      type: 'source-zip-upload',
      msg: `Source zip uploaded successfully`,
      phase: 'stop',
    })

    log(`✔ Source code uploaded`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    statusCb({
      type: 'source-zip-upload',
      msg: `Failed to upload source zip: ${errorMsg}`,
      phase: 'error',
    })

    warn(`Failed to upload source zip: ${errorMsg}`)
    throw error
  } finally {
    // Clean up temporary zip file
    if (zipPath) {
      try {
        await import('fs/promises').then((fs) => fs.unlink(zipPath as unknown as PathLike))
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
