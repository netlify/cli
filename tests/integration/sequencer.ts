import { BaseSequencer, type TestSpecification } from 'vitest/node'

/**
 * Distributes test files across `--shard` buckets via alphabetical round-robin.
 * The default sha1-hash sharding clusters slow files (e.g. all `dev/*` tests)
 * into the same shard. Round-robin breaks those clusters up so each shard ends
 * up with roughly the same total runtime without needing historical timing
 * data. See vitest-dev/vitest#9184 for prior art on duration-aware sharding.
 */
export class BalancedShardSequencer extends BaseSequencer {
  shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shardCfg = this.ctx.config.shard
    if (!shardCfg) return Promise.resolve(files)

    const sorted = [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
    const mine = sorted.filter((_, i) => i % shardCfg.count === shardCfg.index - 1)
    return Promise.resolve(mine)
  }
}
