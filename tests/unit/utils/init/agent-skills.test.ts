import { createHash } from 'node:crypto'
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  DEFAULT_SKILLS_DIRECTORY,
  DEFAULT_SKILLS_HOST,
  type ManifestSkill,
  type SkillsManifest,
  classifySkillsDirectory,
  fetchSkillsManifest,
  hashSkillTree,
  installSkill,
  resolveSkillsDirectories,
  resolveSkillsHost,
  setupAgentSkills,
  syncSkills,
} from '../../../../src/utils/init/agent-skills.js'

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  log: vi.fn(),
  warn: vi.fn(),
}))

type Files = Record<string, string>

interface SkillSpec {
  name: string
  files: Files
  executable?: string[]
  priorNames?: string[]
  previous?: { version: string; files: Files }[]
}

const HOST = 'https://skills.test'

const sha256 = (content: string | Uint8Array) => `sha256:${createHash('sha256').update(content).digest('hex')}`

const treeHashOf = (files: Files, executable: string[] = []) => {
  const hash = createHash('sha256')
  for (const file of Object.keys(files).sort()) {
    const mode = executable.includes(file) ? '100755' : '100644'
    hash.update(`${file}\0${mode}\0${sha256(files[file]).replace(/^sha256:/, '')}\n`)
  }
  return `sha256:${hash.digest('hex')}`
}

const activeSkill = ({ name, files, executable = [], priorNames = [], previous = [] }: SkillSpec): ManifestSkill => ({
  name,
  status: 'active',
  version: '2.0.0',
  prior_names: priorNames,
  description: `${name} skill`,
  tree_hash: treeHashOf(files, executable),
  files: Object.fromEntries(Object.entries(files).map(([file, content]) => [file, sha256(content)])),
  executable,
  history: [
    ...previous.map(({ version, files: oldFiles }) => ({ version, tree_hash: treeHashOf(oldFiles) })),
    { version: '2.0.0', tree_hash: treeHashOf(files, executable) },
  ],
})

const deprecatedSkill = (name: string, shipped: Files, replacedBy?: string): ManifestSkill => ({
  name,
  status: 'deprecated',
  version: null,
  prior_names: [],
  description: `${name} is retired`,
  tree_hash: null,
  files: {},
  executable: [],
  history: [{ version: '1.0.0', tree_hash: treeHashOf(shipped) }],
  deprecated: { since: '2.0.0', ...(replacedBy ? { replaced_by: replacedBy } : {}) },
})

const FUNCTIONS_V1: Files = { 'SKILL.md': '# functions v1\n' }

const FUNCTIONS: SkillSpec = {
  name: 'netlify-functions',
  files: { 'SKILL.md': '# functions v2\n', 'references/routing.md': '# routing\n' },
  previous: [{ version: '1.0.0', files: FUNCTIONS_V1 }],
}

const DEPLOY: SkillSpec = {
  name: 'netlify-deploy',
  files: { 'SKILL.md': '# deploy\n', 'scripts/deploy.sh': '#!/bin/sh\necho deploy\n' },
  executable: ['scripts/deploy.sh'],
  priorNames: ['netlify-cli-and-deploy'],
}

const RETIRED_FILES: Files = { 'SKILL.md': '# retired\n' }

const buildManifest = (skills: SkillSpec[], extraSkills: ManifestSkill[] = []): SkillsManifest => ({
  schema_version: 1,
  version: '2.0.0',
  skills: [...skills.map(activeSkill), ...extraSkills],
})

const hostedResponses = (manifest: SkillsManifest, skills: SkillSpec[]) => {
  const responses = new Map<string, string>([['/manifest.json', JSON.stringify(manifest)]])
  for (const { name, files } of skills) {
    for (const [file, content] of Object.entries(files)) {
      responses.set(`/skills/${name}/${file}`, content)
    }
  }
  return responses
}

const requestPath = (input: string | URL | Request) =>
  decodeURIComponent(new URL(input instanceof Request ? input.url : input).pathname)

const requestedPaths = () => vi.mocked(fetch).mock.calls.map(([input]) => requestPath(input))

const writeSkill = async (root: string, name: string, files: Files, executable: string[] = []) => {
  for (const [file, content] of Object.entries(files)) {
    const target = join(root, name, ...file.split('/'))
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, content)
    await chmod(target, executable.includes(file) ? 0o755 : 0o644)
  }
}

const listDirectories = async (root: string) =>
  (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

describe('agent skills', () => {
  let projectDir: string
  let skillsDir: string

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    projectDir = await mkdtemp(join(tmpdir(), 'agent-skills-'))
    skillsDir = join(projectDir, '.agents', 'skills')
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await rm(projectDir, { recursive: true, force: true })
  })

  describe('resolveSkillsHost', () => {
    test('defaults to the hosted skills site', () => {
      expect(resolveSkillsHost({})).toBe(DEFAULT_SKILLS_HOST)
    })

    test('accepts an https override and strips the trailing slash', () => {
      expect(resolveSkillsHost({ NETLIFY_SKILLS_HOST: 'https://skills.example.com/' })).toBe(
        'https://skills.example.com',
      )
    })

    test('accepts http for loopback only', () => {
      expect(resolveSkillsHost({ NETLIFY_SKILLS_HOST: 'http://localhost:9999' })).toBe('http://localhost:9999')
      expect(() => resolveSkillsHost({ NETLIFY_SKILLS_HOST: 'http://skills.example.com' })).toThrow(/https/)
    })
  })

  describe('resolveSkillsDirectories', () => {
    test('defaults to .agents/skills when no agent directory exists', async () => {
      await expect(resolveSkillsDirectories(projectDir, {})).resolves.toEqual([DEFAULT_SKILLS_DIRECTORY])
    })

    test('uses every agent directory already present in the project', async () => {
      await mkdir(join(projectDir, '.claude'))
      await mkdir(join(projectDir, '.grok'))
      await expect(resolveSkillsDirectories(projectDir, {})).resolves.toEqual([
        join('.claude', 'skills'),
        join('.grok', 'skills'),
      ])
    })

    test('falls back to the driving agent location when nothing exists yet', async () => {
      await expect(resolveSkillsDirectories(projectDir, { NETLIFY_AGENT: 'claude-code' })).resolves.toEqual([
        join('.claude', 'skills'),
      ])
      await expect(resolveSkillsDirectories(projectDir, { NETLIFY_AGENT: 'cursor' })).resolves.toEqual([
        DEFAULT_SKILLS_DIRECTORY,
      ])
    })
  })

  describe('hashSkillTree', () => {
    test('matches the manifest tree_hash formula including the executable bit', async () => {
      await writeSkill(skillsDir, DEPLOY.name, DEPLOY.files, DEPLOY.executable)
      await expect(hashSkillTree(join(skillsDir, DEPLOY.name), new Set(DEPLOY.executable))).resolves.toBe(
        treeHashOf(DEPLOY.files, DEPLOY.executable),
      )
    })
  })

  describe('syncing against a hosted release', () => {
    const skills = [FUNCTIONS, DEPLOY]
    let manifest: SkillsManifest
    let responses: Map<string, string>

    beforeEach(() => {
      manifest = buildManifest(skills, [deprecatedSkill('netlify-legacy', RETIRED_FILES, 'netlify-deploy')])
      responses = hostedResponses(manifest, skills)
      vi.mocked(fetch).mockImplementation((input) => {
        const body = responses.get(requestPath(input))
        return Promise.resolve(body === undefined ? new Response('not found', { status: 404 }) : new Response(body))
      })
    })

    test('installs every active skill into an empty directory with verified bytes and modes', async () => {
      const { actions } = await syncSkills({
        host: HOST,
        directory: skillsDir,
        manifest: await fetchSkillsManifest(HOST),
      })

      expect(actions).toEqual([
        { name: 'netlify-deploy', action: 'added', detail: '2.0.0' },
        { name: 'netlify-functions', action: 'added', detail: '2.0.0' },
      ])
      await expect(listDirectories(skillsDir)).resolves.toEqual(['netlify-deploy', 'netlify-functions'])
      await expect(readFile(join(skillsDir, 'netlify-functions', 'references', 'routing.md'), 'utf8')).resolves.toBe(
        '# routing\n',
      )
      if (process.platform !== 'win32') {
        const script = await stat(join(skillsDir, 'netlify-deploy', 'scripts', 'deploy.sh'))
        expect(script.mode & 0o111).not.toBe(0)
      }
      await expect(readdir(join(skillsDir, 'netlify-functions'))).resolves.toEqual(['SKILL.md', 'references'])
      const [, init] = vi.mocked(fetch).mock.calls[0]
      expect(new Headers(init?.headers).get('user-agent')).toMatch(/^NetlifyCLI /)
    })

    test('is idempotent: a second run reports everything current and changes nothing', async () => {
      await syncSkills({ host: HOST, directory: skillsDir, manifest })
      const before = await stat(join(skillsDir, 'netlify-functions', 'SKILL.md'))
      vi.mocked(fetch).mockClear()

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions).toEqual([
        { name: 'netlify-deploy', action: 'current', detail: '2.0.0' },
        { name: 'netlify-functions', action: 'current', detail: '2.0.0' },
      ])
      const after = await stat(join(skillsDir, 'netlify-functions', 'SKILL.md'))
      expect(after.mtimeMs).toBe(before.mtimeMs)
      expect(requestedPaths()).toEqual([])
    })

    test('replaces a stale copy and keeps a locally edited one', async () => {
      await writeSkill(skillsDir, FUNCTIONS.name, FUNCTIONS_V1)
      await writeSkill(skillsDir, DEPLOY.name, { ...DEPLOY.files, 'SKILL.md': '# my own notes\n' })

      const classification = await classifySkillsDirectory(skillsDir, manifest)
      expect(classification.skills).toEqual([
        { name: 'netlify-deploy', status: 'modified', version: '2.0.0' },
        { name: 'netlify-functions', status: 'stale', version: '2.0.0', have: '1.0.0' },
      ])

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })
      expect(actions).toEqual([
        { name: 'netlify-deploy', action: 'kept', detail: 'edited locally' },
        { name: 'netlify-functions', action: 'updated', detail: '1.0.0 -> 2.0.0' },
      ])
      await expect(readFile(join(skillsDir, 'netlify-functions', 'SKILL.md'), 'utf8')).resolves.toBe('# functions v2\n')
      await expect(readFile(join(skillsDir, 'netlify-deploy', 'SKILL.md'), 'utf8')).resolves.toBe('# my own notes\n')
    })

    test('installs the new name beside a copy under a prior name and leaves the old copy alone', async () => {
      await writeSkill(skillsDir, 'netlify-cli-and-deploy', DEPLOY.files, DEPLOY.executable)

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions).toContainEqual({
        name: 'netlify-cli-and-deploy',
        action: 'kept',
        detail: 'now called netlify-deploy; this copy can be removed',
      })
      expect(actions).toContainEqual({ name: 'netlify-deploy', action: 'added', detail: '2.0.0' })
      await expect(listDirectories(skillsDir)).resolves.toEqual([
        'netlify-cli-and-deploy',
        'netlify-deploy',
        'netlify-functions',
      ])
    })

    test('keeps reporting a renamed copy on the second run without extra downloads', async () => {
      await writeSkill(skillsDir, 'netlify-cli-and-deploy', DEPLOY.files, DEPLOY.executable)
      await syncSkills({ host: HOST, directory: skillsDir, manifest })
      vi.mocked(fetch).mockClear()

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions).toEqual([
        {
          name: 'netlify-cli-and-deploy',
          action: 'kept',
          detail: 'now called netlify-deploy; this copy can be removed',
        },
        { name: 'netlify-deploy', action: 'current', detail: '2.0.0' },
        { name: 'netlify-functions', action: 'current', detail: '2.0.0' },
      ])
      expect(requestedPaths()).toEqual([])
    })

    test('reports a deprecated skill and leaves it and unknown directories alone', async () => {
      await writeSkill(skillsDir, 'netlify-legacy', RETIRED_FILES)
      await writeSkill(skillsDir, 'my-team-skill', { 'SKILL.md': '# ours\n' })

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions).toContainEqual({ name: 'my-team-skill', action: 'ignored', detail: 'not a Netlify skill' })
      expect(actions).toContainEqual({
        name: 'netlify-legacy',
        action: 'kept',
        detail: 'deprecated; use netlify-deploy',
      })
      await expect(listDirectories(skillsDir)).resolves.toEqual([
        'my-team-skill',
        'netlify-deploy',
        'netlify-functions',
        'netlify-legacy',
      ])
    })

    test('reinstalls over an empty directory carrying a skill name', async () => {
      await mkdir(join(skillsDir, FUNCTIONS.name), { recursive: true })

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions).toContainEqual({ name: 'netlify-functions', action: 'added', detail: '2.0.0' })
      await expect(readFile(join(skillsDir, 'netlify-functions', 'SKILL.md'), 'utf8')).resolves.toBe('# functions v2\n')
    })

    test('refuses a manifest with an unsupported schema version', async () => {
      responses.set('/manifest.json', JSON.stringify({ ...manifest, schema_version: 2 }))

      await expect(fetchSkillsManifest(HOST)).rejects.toThrow(/schema 2 is not supported/)
    })

    test('refuses an active skill without a tree hash', async () => {
      const broken = structuredClone(manifest)
      const functions = broken.skills.find(({ name }) => name === 'netlify-functions')
      if (functions) functions.tree_hash = null
      responses.set('/manifest.json', JSON.stringify(broken))

      await expect(fetchSkillsManifest(HOST)).rejects.toThrow(/has no tree_hash/)
    })

    test('follows a symlinked skills root and still keeps edited copies there', async () => {
      const sharedDir = join(projectDir, 'shared-skills')
      await writeSkill(sharedDir, DEPLOY.name, { ...DEPLOY.files, 'SKILL.md': '# my own notes\n' })
      await mkdir(join(projectDir, '.agents'))
      await symlink(sharedDir, skillsDir)

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions).toEqual([
        { name: 'netlify-deploy', action: 'kept', detail: 'edited locally' },
        { name: 'netlify-functions', action: 'added', detail: '2.0.0' },
      ])
      await expect(readFile(join(sharedDir, 'netlify-deploy', 'SKILL.md'), 'utf8')).resolves.toBe('# my own notes\n')
      await expect(listDirectories(sharedDir)).resolves.toEqual(['netlify-deploy', 'netlify-functions'])
    })

    test('never replaces a skill entry that is a symlink', async () => {
      const elsewhere = join(projectDir, 'elsewhere')
      await writeSkill(elsewhere, 'functions-source', FUNCTIONS_V1)
      await mkdir(skillsDir, { recursive: true })
      await symlink(join(elsewhere, 'functions-source'), join(skillsDir, 'netlify-functions'))

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions).toContainEqual({ name: 'netlify-functions', action: 'kept', detail: 'edited locally' })
      expect((await lstat(join(skillsDir, 'netlify-functions'))).isSymbolicLink()).toBe(true)
      await expect(readFile(join(elsewhere, 'functions-source', 'SKILL.md'), 'utf8')).resolves.toBe('# functions v1\n')
    })

    test('refuses to replace a directory that is not an unedited Netlify skill, even when asked directly', async () => {
      await writeSkill(skillsDir, FUNCTIONS.name, { 'SKILL.md': '# mine\n', 'notes.md': '# keep me\n' })
      const functions = manifest.skills.find(({ name }) => name === 'netlify-functions')
      if (!functions) throw new Error('netlify-functions missing from manifest')

      await expect(installSkill(HOST, skillsDir, functions)).rejects.toThrow(/already exists/)
      await expect(readFile(join(skillsDir, 'netlify-functions', 'notes.md'), 'utf8')).resolves.toBe('# keep me\n')
      await expect(listDirectories(skillsDir)).resolves.toEqual(['netlify-functions'])
    })

    test('survives a user directory that differs only by case and keeps syncing the rest', async () => {
      await writeSkill(skillsDir, 'Netlify-Functions', { 'SKILL.md': '# mine\n', 'notes.md': '# keep me\n' })

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      await expect(readFile(join(skillsDir, 'Netlify-Functions', 'notes.md'), 'utf8')).resolves.toBe('# keep me\n')
      expect(actions).toContainEqual({ name: 'netlify-deploy', action: 'added', detail: '2.0.0' })
      const functions = actions.find(({ name }) => name === 'netlify-functions')
      expect(functions?.action === 'added' || functions?.detail?.includes('already exists')).toBe(true)
    })

    test('records a skill whose download fails and keeps installing the others', async () => {
      responses.delete('/skills/netlify-functions/references/routing.md')

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      expect(actions.map(({ name, action }) => `${name}:${action}`)).toEqual([
        'netlify-deploy:added',
        'netlify-functions:failed',
      ])
      expect(actions[1].detail).toMatch(/routing\.md: .*HTTP 404/)
      await expect(listDirectories(skillsDir)).resolves.toEqual(['netlify-deploy'])

      const result = await setupAgentSkills({ workingDir: projectDir, env: { NETLIFY_SKILLS_HOST: HOST } })
      expect(result.installed).toBe(true)
      expect(result.summary).toMatchObject({ current: 1, failed: 1 })
    })

    test('refuses a manifest file path that escapes the skill directory', async () => {
      const escaping = structuredClone(manifest)
      const functions = escaping.skills.find(({ name }) => name === 'netlify-functions')
      if (!functions) throw new Error('netlify-functions missing from manifest')
      functions.files = { ...functions.files, '../../escape.md': sha256('# escaped\n') }
      responses.set('/skills/netlify-functions/../../escape.md', '# escaped\n')

      await expect(installSkill(HOST, skillsDir, functions)).rejects.toThrow(/unsafe manifest file path/)
      await expect(stat(join(projectDir, 'escape.md'))).rejects.toThrow(/ENOENT/)
      await expect(stat(skillsDir)).rejects.toThrow(/ENOENT/)
    })

    test('keeps a directory that appears while the skill is downloading', async () => {
      const fetchHosted = vi.mocked(fetch).getMockImplementation()
      if (!fetchHosted) throw new Error('fetch is not stubbed')
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        if (requestPath(input) === '/skills/netlify-functions/references/routing.md') {
          await writeSkill(skillsDir, 'netlify-functions', { 'SKILL.md': '# written mid-download\n' })
        }
        return fetchHosted(input, init)
      })

      const { actions } = await syncSkills({ host: HOST, directory: skillsDir, manifest })

      const functions = actions.find(({ name }) => name === 'netlify-functions')
      expect(functions?.action).toBe('kept')
      expect(functions?.detail).toMatch(/left in place/)
      await expect(readFile(join(skillsDir, 'netlify-functions', 'SKILL.md'), 'utf8')).resolves.toBe(
        '# written mid-download\n',
      )
      await expect(listDirectories(skillsDir)).resolves.toEqual(['netlify-deploy', 'netlify-functions'])
    })

    test('rejects a file whose bytes do not match the manifest and leaves no partial install', async () => {
      responses.set('/skills/netlify-functions/SKILL.md', '# tampered\n')
      const functions = manifest.skills.find(({ name }) => name === 'netlify-functions')
      if (!functions) throw new Error('netlify-functions missing from manifest')

      await expect(installSkill(HOST, skillsDir, functions)).rejects.toThrow(/hash mismatch/)
      await expect(stat(skillsDir)).rejects.toThrow(/ENOENT/)
    })

    test('setupAgentSkills installs into the detected directories and reports a summary', async () => {
      await mkdir(join(projectDir, '.claude'))
      const result = await setupAgentSkills({ workingDir: projectDir, env: { NETLIFY_SKILLS_HOST: HOST } })

      expect(result.installed).toBe(true)
      expect(result.directories).toEqual([join('.claude', 'skills')])
      expect(result.skillsVersion).toBe('2.0.0')
      expect(result.summary.added).toBe(2)
      await expect(listDirectories(join(projectDir, '.claude', 'skills'))).resolves.toEqual([
        'netlify-deploy',
        'netlify-functions',
      ])
    })
  })

  test('setupAgentSkills does not throw when the host is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

    const result = await setupAgentSkills({ workingDir: projectDir, env: { NETLIFY_SKILLS_HOST: HOST } })

    expect(result.installed).toBe(false)
    expect(result.error).toBe('fetch failed')
    await expect(readdir(projectDir)).resolves.toEqual([])
  })

  test('setupAgentSkills reports a timed out download in plain words', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))

    const result = await setupAgentSkills({ workingDir: projectDir, env: { NETLIFY_SKILLS_HOST: HOST } })

    expect(result.installed).toBe(false)
    expect(result.error).toBe('the download timed out after 10s')
  })
})
