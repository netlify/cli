import { BaseSequencer, type TestSpecification } from 'vitest/node'

/**
 * Round-robin sharding so slow files (e.g. all `dev/*` tests) don't cluster in
 * the same shard like they do under vitest's default sha1-hash distribution.
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
