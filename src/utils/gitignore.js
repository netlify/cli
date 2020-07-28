const path = require('path')
const fs = require('fs')
const parseIgnore = require('parse-gitignore')
const { promisify } = require('util')
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

function fileExists(filePath) {
  return new Promise((resolve, reject) => {
    fs.access(filePath, fs.F_OK, err => {
      if (err) return resolve(false)
      return resolve(true)
    })
  })
}

async function hasGitIgnore(dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const hasIgnore = await fileExists(gitIgnorePath)
  return hasIgnore
}

function parser(input, fn = line => line) {
  const lines = input.toString().split(/\r?\n/)
  let section = { name: 'default', patterns: [] }
  const state = { patterns: [], sections: [section] }

  for (const line of lines) {
    if (line.charAt(0) === '#') {
      section = { name: line.slice(1).trim(), patterns: [] }
      state.sections.push(section)
      continue
    }

    if (line.trim() !== '') {
      const pattern = fn(line, section, state)
      section.patterns.push(pattern)
      state.patterns.push(pattern)
    }
  }
  return state
}

function stringify(state) {
  return parseIgnore.stringify(state.sections, section => {
    if (!section.patterns.length) {
      return ''
    }

    return `# ${section.name}\n${section.patterns.join('\n')}\n\n`
  })
}

function parse(input, fn) {
  const state = parser(input, fn)

  state.concat = i => {
    const newState = parser(i, fn)

    for (const s2 in newState.sections) {
      const sec2 = newState.sections[s2]

      let sectionExists = false
      for (const s1 in state.sections) {
        const sec1 = state.sections[s1]

        // Join sections under common name
        if (sec1.name === sec2.name) {
          sectionExists = true
          sec1.patterns = Array.from(new Set(sec1.patterns.concat(sec2.patterns)))
        }
      }

      // Add new section
      if (!sectionExists) {
        state.sections.push(sec2)
      }
    }

    return state
  }

  return state
}

async function ensureNetlifyIgnore(dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const ignoreContent = '# Local Netlify folder\n.netlify'

  /* No .gitignore file. Create one and ignore .netlify folder */
  if (!(await hasGitIgnore(dir))) {
    await writeFile(gitIgnorePath, ignoreContent, 'utf8')
    return false
  }

  let gitIgnoreContents
  let ignorePatterns
  try {
    gitIgnoreContents = await readFile(gitIgnorePath, 'utf8')
    ignorePatterns = parseIgnore.parse(gitIgnoreContents)
  } catch (e) {
    // ignore
  }
  /* Not ignoring .netlify folder. Add to .gitignore */
  if (!ignorePatterns || !ignorePatterns.patterns.includes('.netlify')) {
    const newContents = `${gitIgnoreContents}\n${ignoreContent}`
    await writeFile(gitIgnorePath, newContents, 'utf8')
  }
}

module.exports = {
  parse,
  stringify,
  format: parseIgnore.format,
  ensureNetlifyIgnore,
}
