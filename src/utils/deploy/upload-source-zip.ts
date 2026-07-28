import { readFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { platform } from 'node:os'

import execa, { ExecaError } from 'execa'
import fetch from 'node-fetch'

import { log, warn } from '../command-helpers.js'
import { temporaryDirectory } from '../temporary-file.js'
import type { DeployEvent } from './status-cb.js'

/**
 * Thrown when the source zip would be empty — every file matched an ignore
 * pattern (or the directory is empty), so `zip` exits with code 12 ("nothing to
 * do"). This is not a failure: there is simply nothing to deploy. Callers decide
 * how to surface it (the deploy command exits with a dedicated code so upstream
 * tooling can detect it).
 */
export class EmptySourceZipError extends Error {
  constructor() {
    super('Source zip is empty: no files to deploy after applying ignore patterns')
    this.name = 'EmptySourceZipError'
  }
}

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules*',
  '.git*',
  '.netlify*',
  '.next*',
  'dist*',
  'build*',
  '.nuxt*',
  '.output*',
  '.vercel*',
  '__pycache__*',
  '.venv*',
  '.env',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '.nyc_output*',
  'coverage*',
  '.cache*',
  '.tmp*',
  '.temp*',
]

// `zip` exits with code 12 ("nothing to do") when no files were added to the
// archive (everything matched an exclude, or the directory is empty).
const isEmptyZipError = (error: unknown): boolean => {
  const err = error as { exitCode?: number; all?: string; stderr?: string } | null
  if (!err) {
    return false
  }
  return err.exitCode === 12 || /nothing to do/iu.test(err.all ?? err.stderr ?? '')
}

/**
 * Creates the source zip in a temporary directory and returns its path. The
 * caller uploads it via `uploadSourceZip`, which removes the temporary directory
 * afterwards. On any failure (including an empty archive) the directory is
 * removed here before throwing.
 *
 * Throws `EmptySourceZipError` when the archive would be empty, so the caller
 * can avoid creating a deploy for a source that has nothing to upload.
 */
export const createSourceZip = async ({
  sourceDir,
  statusCb = () => {},
}: {
  sourceDir: string
  statusCb?: (status: DeployEvent) => void
}): Promise<string> => {
  const zipPath = join(temporaryDirectory(), 'source.zip')

  try {
    // Check for Windows - this feature is not supported on Windows
    if (platform() === 'win32') {
      throw new Error('Source zip upload is not supported on Windows')
    }

    statusCb({
      type: 'source-zip-upload',
      msg: `Creating source zip...`,
      phase: 'start',
    })

    // Create exclusion list for zip command
    const excludeArgs = DEFAULT_IGNORE_PATTERNS.flatMap((pattern) => ['-x', pattern])

    // Use system zip command to create the archive
    try {
      await execa('zip', ['-r', '-q', zipPath, '.', ...excludeArgs], {
        all: true,
        cwd: sourceDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (baseErr) {
      // An empty archive is an expected outcome, not a failure — let the caller decide.
      if (isEmptyZipError(baseErr)) {
        throw new EmptySourceZipError()
      }

      let message = 'zip command failed'
      if (baseErr instanceof Error && 'command' in baseErr) {
        const execaErr = baseErr as ExecaError
        message = `${execaErr.shortMessage}\n\n${execaErr.all ?? ''}`
      }
      throw new Error(message, { cause: baseErr })
    }

    return zipPath
  } catch (error) {
    // Nothing usable was produced; drop the temp directory we created.
    await removeSourceZipDir(zipPath)

    // An empty source zip is not a reported failure.
    if (error instanceof EmptySourceZipError) {
      throw error
    }

    const errorMsg = error instanceof Error ? error.message : String(error)
    statusCb({
      type: 'source-zip-upload',
      msg: `Failed to create source zip: ${errorMsg}`,
      phase: 'error',
    })
    warn(`Failed to create source zip: ${errorMsg}`)
    throw error
  }
}

// Removes the temporary directory that holds a source zip. Best-effort:
// cleanup failures are ignored.
const removeSourceZipDir = async (zipPath: string): Promise<void> => {
  try {
    await rm(dirname(zipPath), { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

const uploadZipToS3 = async (zipPath: string, uploadUrl: string, statusCb: (status: DeployEvent) => void) => {
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
    throw new Error(`Failed to upload zip: ${response.statusText}`)
  }
}

/**
 * Uploads a source zip previously created by `createSourceZip` and removes its
 * temporary directory afterwards.
 */
export const uploadSourceZip = async ({
  zipPath,
  uploadUrl,
  statusCb = () => {},
}: {
  zipPath: string
  uploadUrl: string
  statusCb?: (status: DeployEvent) => void
}): Promise<void> => {
  try {
    try {
      await uploadZipToS3(zipPath, uploadUrl, statusCb)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      statusCb({
        type: 'source-zip-upload',
        msg: `Failed to upload source zip: ${errorMsg}`,
        phase: 'error',
      })
      warn(`Failed to upload source zip: ${errorMsg}`)
      throw error
    }

    statusCb({
      type: 'source-zip-upload',
      msg: `Source zip uploaded successfully`,
      phase: 'stop',
    })

    log(`✔ Source code uploaded`)
  } finally {
    await removeSourceZipDir(zipPath)
  }
}
