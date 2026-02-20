// Deletes Netlify sites created during integration tests.
// Reads site IDs from .netlify-test-site-ids (one per line),
// deletes each site via the CLI, then removes the file.

import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SITE_IDS_FILE = resolve(fileURLToPath(import.meta.url), '../../.netlify-test-site-ids')

if (!existsSync(SITE_IDS_FILE)) {
  console.log('No test sites to clean up.')
} else {
  const siteIds = readFileSync(SITE_IDS_FILE, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (siteIds.length === 0) {
    console.log('No test sites to clean up.')
  } else {
    console.log(`Cleaning up ${siteIds.length} test site(s)...`)

    for (const siteId of siteIds) {
      try {
        console.log(`Deleting site ${siteId}...`)
        execFileSync('node', ['./bin/run.js', 'sites:delete', siteId, '--force'], {
          stdio: 'inherit',
          timeout: 30_000,
        })
        console.log(`Deleted site ${siteId}`)
      } catch (error) {
        console.error(`Failed to delete site ${siteId}:`, error.message)
      }
    }
  }

  unlinkSync(SITE_IDS_FILE)
  console.log('Cleanup complete.')
}
