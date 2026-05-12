import fs from 'fs/promises'
import path from 'path'

import type { AgentsApi } from './api.js'
import { MAX_ATTACHMENT_SIZE_BYTES, MAX_ATTACHMENTS_PER_REQUEST } from './constants.js'
import { formatBytes, getMimeType } from './utils.js'

export interface UploadedAttachment {
  path: string
  filename: string
  fileKey: string
  size: number
  contentType: string
}

const cleanupOrphans = async (api: AgentsApi, accountId: string, fileKeys: string[]): Promise<void> => {
  await Promise.allSettled(
    fileKeys.map(async (fileKey) => {
      try {
        const { delete_url: deleteUrl } = await api.createAgentRunnerDeleteUrl({
          account_id: accountId,
          file_key: fileKey,
        })
        await fetch(deleteUrl, { method: 'DELETE' })
      } catch {
        // Best-effort cleanup; if it fails, the orphan is the user's tenant problem.
      }
    }),
  )
}

export const uploadAttachments = async (
  api: AgentsApi,
  accountId: string,
  filePaths: string[],
): Promise<UploadedAttachment[]> => {
  if (filePaths.length === 0) return []
  if (filePaths.length > MAX_ATTACHMENTS_PER_REQUEST) {
    throw new Error(
      `Too many attachments: ${filePaths.length.toString()} given, max is ${MAX_ATTACHMENTS_PER_REQUEST.toString()}`,
    )
  }

  const resolved = await Promise.all(
    filePaths.map(async (filePath) => {
      const absolute = path.resolve(filePath)
      const stat = await fs.stat(absolute).catch(() => null)
      if (!stat?.isFile()) {
        throw new Error(`Attachment not found or not a file: ${filePath}`)
      }
      if (stat.size > MAX_ATTACHMENT_SIZE_BYTES) {
        throw new Error(
          `Attachment ${filePath} is ${formatBytes(stat.size)}, exceeds the ${formatBytes(
            MAX_ATTACHMENT_SIZE_BYTES,
          )} limit`,
        )
      }
      const filename = path.basename(absolute)
      return { path: absolute, filename, size: stat.size, contentType: getMimeType(filename) }
    }),
  )

  const uploaded: UploadedAttachment[] = []
  try {
    for (const file of resolved) {
      const { upload_url: uploadUrl, file_key: fileKey } = await api.createAgentRunnerUploadUrl({
        account_id: accountId,
        filename: file.filename,
        content_type: file.contentType,
      })

      const body = await fs.readFile(file.path)
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
      }, 60_000)
      let putResponse: Response
      try {
        putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: new Uint8Array(body),
          headers: { 'Content-Type': file.contentType },
          signal: controller.signal,
        })
      } catch (error_) {
        const error = error_ as Error
        if (error.name === 'AbortError') {
          throw new Error(`Upload of ${file.filename} timed out after 60s`)
        }
        throw error
      } finally {
        clearTimeout(timeout)
      }
      if (!putResponse.ok) {
        throw new Error(
          `Failed to upload ${file.filename}: HTTP ${putResponse.status.toString()} ${putResponse.statusText}`,
        )
      }
      uploaded.push({ ...file, fileKey })
    }
    return uploaded
  } catch (error) {
    if (uploaded.length > 0) {
      await cleanupOrphans(
        api,
        accountId,
        uploaded.map((entry) => entry.fileKey),
      )
    }
    throw error
  }
}
