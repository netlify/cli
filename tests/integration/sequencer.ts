import { readFileSync } from 'node:fs'

import { BaseSequencer, type TestSpecification } from 'vitest/node'

/**
 * Distributes test files across `--shard` buckets via greedy LPT bin-packing,
 * weighted by the number of `it()` / `test()` calls in each file. Heavier
 * files land first so each shard ends up with roughly the same total runtime.
 * See vitest-dev/vitest#9184 for prior art on duration-aware sharding.
 */

function countTestCases(filePath: string): number {
  try {
    const src = readFileSync(filePath, 'utf8')
    const matches = src.match(/\b(?:test|it)(?:\.\w+)?\(/g)
    return matches?.length ?? 1
  } catch {
    return 1
  }
}

export class BalancedShardSequencer extends BaseSequencer {
  shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shardCfg = this.ctx.config.shard
    if (!shardCfg) return Promise.resolve(files)

    const weighted = files
      .map((spec) => ({
        spec,
        key: spec.moduleId,
        weight: countTestCases(spec.moduleId),
      }))
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
