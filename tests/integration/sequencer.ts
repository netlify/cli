import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { BaseSequencer, type TestSpecification } from 'vitest/node'

/**
 * Distributes test files across `--shard` buckets using greedy LPT bin-packing,
 * weighted by historical per-file duration from vitest's own results cache.
 * Same approach as vitest-dev/vitest#9184 and the `@tenbin/vitest` package.
 */

interface CachedResult {
  duration: number
  failed: boolean
}

interface ResultsFile {
  version: string
  results: [key: string, CachedResult][]
}

// Non-zero so files without prior timing data still participate in bin-packing.
// Matches @tenbin/vitest's FALLBACK_DURATION.
const FALLBACK_DURATION = 0.1

function loadDurationCache(root: string): Map<string, number> {
  const cacheRoot = path.join(root, 'node_modules', '.vite', 'vitest')
  const map = new Map<string, number>()
  let entries: string[]
  try {
    entries = readdirSync(cacheRoot)
  } catch {
    return map
  }
  for (const entry of entries) {
    try {
      const raw = readFileSync(path.join(cacheRoot, entry, 'results.json'), 'utf8')
      const parsed = JSON.parse(raw) as ResultsFile
      for (const [key, result] of parsed.results) {
        const rel = key.startsWith(':') ? key.slice(1) : key
        if (result.duration > 0) map.set(rel, result.duration)
      }
      if (map.size > 0) return map
    } catch {
      // try next entry
    }
  }
  return map
}

function toPosixRelative(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/')
}

export class BalancedShardSequencer extends BaseSequencer {
  shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shardCfg = this.ctx.config.shard
    if (!shardCfg) return Promise.resolve(files)

    const { root } = this.ctx.config
    const cache = loadDurationCache(root)

    const weighted = files
      .map((spec) => {
        const key = toPosixRelative(root, spec.moduleId)
        const weight = cache.get(key) ?? FALLBACK_DURATION
        return { spec, key, weight }
      })
      .sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key))

    const buckets = Array.from({ length: shardCfg.count }, () => ({
      specs: [] as TestSpecification[],
      total: 0,
    }))

    for (const { spec, weight } of weighted) {
      let target = buckets[0]
      for (const bucket of buckets) {
        if (bucket.total < target.total) target = bucket
      }
      target.specs.push(spec)
      target.total += weight
    }

    return Promise.resolve(buckets[shardCfg.index - 1].specs)
  }
}
