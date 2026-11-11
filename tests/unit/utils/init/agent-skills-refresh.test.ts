import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { type ManifestSkill, type SkillsManifest, setupAgentSkills } from '../../../../src/utils/init/agent-skills.js'
import {
  REFRESH_INTERVAL_MS,
  installedSkillsDirectories,
  refreshAgentSkills,
  showAgentSkillsRefreshNotice,
  startAgentSkillsRefresh,
} from '../../../../src/utils/init/agent-skills-refresh.js'
import {
  AGENT_SKILLS_STATE_FILE,
  type AgentSkillsState,
  readAgentSkillsState,
} from '../../../../src/utils/init/agent-skills-state.js'

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  log: vi.fn(),
  warn: vi.fn(),
}))

type Files = Record<string, string>

const HOST = 'https://skills.test'
const ENV = { NETLIFY_SKILLS_HOST: HOST }

const sha256 = (content: string) => `sha256:${createHash('sha256').update(content).digest('hex')}`

const treeHashOf = (files: Files) => {
  const hash = createHash('sha256')
  for (const file of Object.keys(files).sort()) {
    hash.update(`${file}\u0000100644\u0000${sha256(files[file]).replace(/^sha256:/, '')}\n`)
  }
  return `sha256:${hash.digest('hex')}`
}

interface Release {
  name: string
  files: Files
  previous?: Files
}

const activeSkill = ({ name, files, previous }: Release): ManifestSkill => ({
  name,
  status: 'active',
  version: '2.0.0',
  prior_names: [],
  tree_hash: treeHashOf(files),
  files: Object.fromEntries(Object.entries(files).map(([file, content]) => [file, sha256(content)])),
  executable: [],
  history: [
    ...(previous ? [{ version: '1.0.0', tree_hash: treeHashOf(previous) }] : []),
    { version: '2.0.0', tree_hash: treeHashOf(files) },
  ],
})

const FUNCTIONS_V1: Files = { 'SKILL.md': '# functions v1\n' }
const FUNCTIONS: Release = {
  name: 'netlify-functions',
  files: { 'SKILL.md': '# functions v2\n' },
  previous: FUNCTIONS_V1,
}
const BLOBS: Release = { name: 'netlify-blobs', files: { 'SKILL.md': '# blobs\n' } }
const CACHING: Release = { name: 'netlify-caching', files: { 'SKILL.md': '# caching\n' } }

const requestPath = (input: string | URL | Request) =>
  decodeURIComponent(new URL(input instanceof Request ? input.url : input).pathname)

const requestedPaths = () => vi.mocked(fetch).mock.calls.map(([input]) => requestPath(input))

const userAgents = () => [
  ...new Set(vi.mocked(fetch).mock.calls.map(([, init]) => new Headers(init?.headers).get('user-agent'))),
]

const conditionalHeaders = () =>
  vi.mocked(fetch).mock.calls.map(([, init]) => new Headers(init?.headers).get('if-none-match'))

/** Serves `releases` with `etag` on the manifest, answering 304 to a matching If-None-Match. */
const host = (releases: Release[], etag: string) => {
  const manifest: SkillsManifest = { schema_version: 1, version: '2.0.0', skills: releases.map(activeSkill) }
  const files = new Map<string, string>()
  for (const { name, files: released } of releases) {
    for (const [file, content] of Object.entries(released)) {
      files.set(`/skills/${name}/${file}`, content)
    }
  }
  vi.mocked(fetch).mockImplementation((input, init) => {
    const path = requestPath(input)
    if (path === '/manifest.json') {
      if (new Headers(init?.headers).get('if-none-match') === etag) {
        return Promise.resolve(new Response(null, { status: 304 }))
      }
      return Promise.resolve(new Response(JSON.stringify(manifest), { headers: { etag } }))
    }
    const body = files.get(path)
    return Promise.resolve(body === undefined ? new Response('not found', { status: 404 }) : new Response(body))
  })
  return { files }
}

const writeSkill = async (root: string, name: string, files: Files) => {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(join(root, name), { recursive: true })
    await writeFile(join(root, name, file), content)
  }
}

const writeState = async (projectDir: string, state: AgentSkillsState) => {
  await mkdir(join(projectDir, '.netlify'), { recursive: true })
  await writeFile(join(projectDir, AGENT_SKILLS_STATE_FILE), JSON.stringify(state))
}

const skillNames = async (dir: string) => (await readdir(dir)).sort()

describe('agent skills background refresh', () => {
  let projectDir: string
  let claudeSkills: string

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    projectDir = await mkdtemp(join(tmpdir(), 'agent-skills-refresh-'))
    claudeSkills = join(projectDir, '.claude', 'skills')
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await rm(projectDir, { recursive: true, force: true })
  })

  describe('installedSkillsDirectories', () => {
    test('finds nothing in a project without agent directories', async () => {
      await expect(installedSkillsDirectories(projectDir)).resolves.toEqual([])
    })

    test('only counts directories that hold a Netlify skill', async () => {
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      await writeSkill(join(projectDir, '.agents', 'skills'), 'my-own-skill', { 'SKILL.md': '# mine\n' })
      await mkdir(join(projectDir, '.grok', 'skills', 'netlify-blobs'), { recursive: true })

      await expect(installedSkillsDirectories(projectDir)).resolves.toEqual([join('.claude', 'skills')])
    })

    test('recognizes a skill without the netlify- prefix once the project knows its name', async () => {
      await writeSkill(claudeSkills, 'edge-helpers', { 'SKILL.md': '# edge\n' })

      await expect(installedSkillsDirectories(projectDir)).resolves.toEqual([])
      await expect(installedSkillsDirectories(projectDir, ['edge-helpers'])).resolves.toEqual([
        join('.claude', 'skills'),
      ])
    })
  })

  describe('startAgentSkillsRefresh', () => {
    const now = Date.UTC(2026, 10, 10, 12)

    test('starts a refresh when skills are installed and records when it did', async () => {
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      const spawn = vi.fn()

      await expect(
        startAgentSkillsRefresh({ repositoryRoot: projectDir, env: {}, now, ci: false, spawn }),
      ).resolves.toBe(true)

      expect(spawn).toHaveBeenCalledWith(projectDir)
      await expect(readAgentSkillsState(projectDir)).resolves.toEqual({ checkedAt: now })
      expect(fetch).not.toHaveBeenCalled()
    })

    test('waits for the interval between refreshes', async () => {
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      await writeState(projectDir, { checkedAt: now })
      const spawn = vi.fn()
      const start = (at: number) =>
        startAgentSkillsRefresh({ repositoryRoot: projectDir, env: {}, now: at, ci: false, spawn })

      await expect(start(now + REFRESH_INTERVAL_MS - 1)).resolves.toBe(false)
      await expect(start(now + REFRESH_INTERVAL_MS)).resolves.toBe(true)
      expect(spawn).toHaveBeenCalledTimes(1)
    })

    test('treats a check recorded in the future as due', async () => {
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      await writeState(projectDir, { checkedAt: now + 60_000 })
      const spawn = vi.fn()

      await expect(
        startAgentSkillsRefresh({ repositoryRoot: projectDir, env: {}, now, ci: false, spawn }),
      ).resolves.toBe(true)
    })

    test('does nothing, and writes nothing, in a project without Netlify skills', async () => {
      await mkdir(join(projectDir, '.claude'))
      const spawn = vi.fn()

      await expect(
        startAgentSkillsRefresh({ repositoryRoot: projectDir, env: {}, now, ci: false, spawn }),
      ).resolves.toBe(false)

      expect(spawn).not.toHaveBeenCalled()
      await expect(stat(join(projectDir, '.netlify'))).rejects.toThrow(/ENOENT/)
    })

    test('does nothing in CI or when turned off', async () => {
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      const spawn = vi.fn()

      await expect(
        startAgentSkillsRefresh({ repositoryRoot: projectDir, env: {}, now, ci: true, spawn }),
      ).resolves.toBe(false)
      await expect(
        startAgentSkillsRefresh({
          repositoryRoot: projectDir,
          env: { NETLIFY_SKILLS_AUTO_UPDATE: 'false' },
          now,
          ci: false,
          spawn,
        }),
      ).resolves.toBe(false)
      expect(spawn).not.toHaveBeenCalled()
    })
  })

  describe('refreshAgentSkills', () => {
    test('downloads nothing when the manifest is unchanged', async () => {
      host([FUNCTIONS], '"v2"')
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      await writeState(projectDir, { etag: '"v2"', knownSkills: ['netlify-functions'] })

      await expect(refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })).resolves.toEqual([])

      expect(requestedPaths()).toEqual(['/manifest.json'])
      expect(conditionalHeaders()).toEqual(['"v2"'])
      await expect(readFile(join(claudeSkills, 'netlify-functions', 'SKILL.md'), 'utf8')).resolves.toBe(
        '# functions v1\n',
      )
    })

    test('updates a stale skill, adds a newly published one and leaves a deleted one out', async () => {
      host([FUNCTIONS, BLOBS, CACHING], '"v2"')
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      await writeState(projectDir, { etag: '"v1"', knownSkills: ['netlify-blobs', 'netlify-functions'] })

      const changes = await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

      expect(changes).toEqual([
        {
          directory: join('.claude', 'skills'),
          actions: [
            { name: 'netlify-functions', action: 'updated', detail: '1.0.0 -> 2.0.0' },
            { name: 'netlify-caching', action: 'added', detail: '2.0.0' },
          ],
        },
      ])
      await expect(skillNames(claudeSkills)).resolves.toEqual(['netlify-caching', 'netlify-functions'])
      const state = await readAgentSkillsState(projectDir)
      expect(state.etag).toBe('"v2"')
      expect(state.knownSkills).toEqual(['netlify-blobs', 'netlify-caching', 'netlify-functions'])
      expect(state.notice).toEqual(changes)
      expect(userAgents()).toEqual([expect.stringMatching(/^NetlifyCLI \S+ \(refresh\)$/)])
    })

    test('adds missing skills on a first refresh with no record of what the project had', async () => {
      host([FUNCTIONS, BLOBS], '"v2"')
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)

      await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

      await expect(skillNames(claudeSkills)).resolves.toEqual(['netlify-blobs', 'netlify-functions'])
      await expect(readFile(join(claudeSkills, 'netlify-functions', 'SKILL.md'), 'utf8')).resolves.toBe(
        '# functions v2\n',
      )
      await expect(readAgentSkillsState(projectDir)).resolves.toMatchObject({
        etag: '"v2"',
        knownSkills: ['netlify-blobs', 'netlify-functions'],
      })
    })

    test('records only the skills installed in every directory', async () => {
      const agentsSkills = join(projectDir, '.agents', 'skills')
      const { files } = host([FUNCTIONS, BLOBS], '"v2"')
      files.delete('/skills/netlify-blobs/SKILL.md')
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS.files)
      await writeSkill(claudeSkills, 'netlify-blobs', BLOBS.files)
      await writeSkill(agentsSkills, 'netlify-functions', FUNCTIONS.files)
      await writeState(projectDir, { knownSkills: ['netlify-functions'] })

      await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

      await expect(skillNames(agentsSkills)).resolves.toEqual(['netlify-functions'])
      await expect(readAgentSkillsState(projectDir)).resolves.toMatchObject({ knownSkills: ['netlify-functions'] })
    })

    test('only writes to directories that already hold Netlify skills', async () => {
      host([FUNCTIONS, CACHING], '"v2"')
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      await mkdir(join(projectDir, '.agents', 'skills'), { recursive: true })
      await writeState(projectDir, { knownSkills: ['netlify-functions'] })

      await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

      await expect(skillNames(claudeSkills)).resolves.toEqual(['netlify-caching', 'netlify-functions'])
      await expect(readdir(join(projectDir, '.agents', 'skills'))).resolves.toEqual([])
    })

    test('keeps an edited skill and reports no change', async () => {
      host([FUNCTIONS], '"v2"')
      await writeSkill(claudeSkills, 'netlify-functions', { 'SKILL.md': '# my notes\n' })
      await writeState(projectDir, { knownSkills: ['netlify-functions'] })

      await expect(refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })).resolves.toEqual([])

      await expect(readFile(join(claudeSkills, 'netlify-functions', 'SKILL.md'), 'utf8')).resolves.toBe('# my notes\n')
      await expect(readAgentSkillsState(projectDir)).resolves.not.toHaveProperty('notice')
    })

    test('downloads the manifest again next time when a skill failed to download', async () => {
      const { files } = host([FUNCTIONS], '"v2"')
      files.delete('/skills/netlify-functions/SKILL.md')
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS_V1)
      await writeState(projectDir, { etag: '"v1"', knownSkills: ['netlify-functions'] })

      await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })
      await expect(readAgentSkillsState(projectDir)).resolves.not.toHaveProperty('etag')

      host([FUNCTIONS], '"v2"')
      vi.mocked(fetch).mockClear()
      await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

      expect(conditionalHeaders()[0]).toBeNull()
      await expect(readFile(join(claudeSkills, 'netlify-functions', 'SKILL.md'), 'utf8')).resolves.toBe(
        '# functions v2\n',
      )
    })

    test('adds a newly published skill on a later refresh when its download failed', async () => {
      const { files } = host([FUNCTIONS, CACHING], '"v2"')
      files.delete('/skills/netlify-caching/SKILL.md')
      await writeSkill(claudeSkills, 'netlify-functions', FUNCTIONS.files)
      await writeState(projectDir, { etag: '"v1"', knownSkills: ['netlify-blobs', 'netlify-functions'] })

      await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

      await expect(skillNames(claudeSkills)).resolves.toEqual(['netlify-functions'])
      const state = await readAgentSkillsState(projectDir)
      expect(state.knownSkills).toEqual(['netlify-blobs', 'netlify-functions'])
      expect(state).not.toHaveProperty('etag')

      host([FUNCTIONS, CACHING], '"v2"')
      vi.mocked(fetch).mockClear()
      await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

      expect(conditionalHeaders()[0]).toBeNull()
      await expect(skillNames(claudeSkills)).resolves.toEqual(['netlify-caching', 'netlify-functions'])
      await expect(readAgentSkillsState(projectDir)).resolves.toMatchObject({
        etag: '"v2"',
        knownSkills: ['netlify-blobs', 'netlify-caching', 'netlify-functions'],
      })
    })
  })

  describe('showAgentSkillsRefreshNotice', () => {
    test('shows what a refresh changed once', async () => {
      await writeState(projectDir, {
        checkedAt: 1,
        notice: [
          {
            directory: join('.claude', 'skills'),
            actions: [{ name: 'netlify-functions', action: 'updated', detail: '1.0.0 -> 2.0.0' }],
          },
        ],
      })
      const write = vi.fn()

      await showAgentSkillsRefreshNotice({ repositoryRoot: projectDir, write })
      await showAgentSkillsRefreshNotice({ repositoryRoot: projectDir, write })

      expect(write).toHaveBeenCalledTimes(1)
      expect(write.mock.calls[0][0]).toMatch(/Synced Netlify skills in .*\(1 updated\)\./)
      await expect(readAgentSkillsState(projectDir)).resolves.toEqual({ checkedAt: 1 })
    })
  })

  test('setupAgentSkills records the manifest so later refreshes start from it', async () => {
    host([FUNCTIONS, BLOBS], '"v2"')
    await mkdir(join(projectDir, '.claude'))

    await setupAgentSkills({ workingDir: projectDir, env: ENV })

    expect(userAgents()).toEqual([expect.stringMatching(/^NetlifyCLI \S+ \(init\)$/)])
    await expect(readAgentSkillsState(projectDir)).resolves.toMatchObject({
      etag: '"v2"',
      knownSkills: ['netlify-blobs', 'netlify-functions'],
    })
    vi.mocked(fetch).mockClear()
    await expect(refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })).resolves.toEqual([])
    expect(requestedPaths()).toEqual(['/manifest.json'])
  })

  test('a skill that failed to download during setupAgentSkills is added by a later refresh', async () => {
    const { files } = host([FUNCTIONS, BLOBS], '"v2"')
    files.delete('/skills/netlify-blobs/SKILL.md')
    await mkdir(join(projectDir, '.claude'))

    await setupAgentSkills({ workingDir: projectDir, env: ENV })

    await expect(skillNames(claudeSkills)).resolves.toEqual(['netlify-functions'])
    const state = await readAgentSkillsState(projectDir)
    expect(state.knownSkills).toEqual(['netlify-functions'])
    expect(state).not.toHaveProperty('etag')

    host([FUNCTIONS, BLOBS], '"v2"')
    await refreshAgentSkills({ repositoryRoot: projectDir, env: ENV })

    await expect(skillNames(claudeSkills)).resolves.toEqual(['netlify-blobs', 'netlify-functions'])
  })
})
