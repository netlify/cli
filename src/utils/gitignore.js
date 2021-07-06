const path = require('path')

const parseIgnore = require('parse-gitignore')

const { readFileAsync, writeFileAsync, fileExistsAsync } = require('../lib/fs')

const hasGitIgnore = async function (dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const hasIgnore = await fileExistsAsync(gitIgnorePath)
  return hasIgnore
}

const parser = function (input, fn = (line) => line) {
  const lines = input.toString().split(/\r?\n/)
  let section = { name: 'default', patterns: [] }
  const state = { patterns: [], sections: [section] }

  lines.forEach((line) => {
    if (line.charAt(0) === '#') {
      section = { name: line.slice(1).trim(), patterns: [] }
      state.sections.push(section)
      return
    }

    if (line.trim() !== '') {
      const pattern = fn(line, section, state)
      section.patterns.push(pattern)
      state.patterns.push(pattern)
    }
  })
  return state
}

const stringify = function (state) {
  return parseIgnore.stringify(state.sections, (section) => {
    if (section.patterns.length === 0) {
      return ''
    }

    return `# ${section.name}\n${section.patterns.join('\n')}\n\n`
  })
}

const parse = function (input, fn) {
  const state = parser(input, fn)

  state.concat = (stateInput) => {
    const newState = parser(stateInput, fn)
    Object.keys(newState.sections).forEach((s2) => {
      const sec2 = newState.sections[s2]

      let sectionExists = false

      state.sections.forEach((s1) => {
        const sec1 = state.sections[s1]

        // Join sections under common name
        if (sec1.name === sec2.name) {
          sectionExists = true
          sec1.patterns = [...new Set(sec1.patterns.concat(sec2.patterns))]
        }
      })

      // Add new section
      if (!sectionExists) {
        state.sections.push(sec2)
      }
    })

    return state
  }

  return state
}

const ensureNetlifyIgnore = async function (dir) {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const ignoreContent = '# Local Netlify folder\n.netlify'

  /* No .gitignore file. Create one and ignore .netlify folder */
  if (!(await hasGitIgnore(dir))) {
    await writeFileAsync(gitIgnorePath, ignoreContent, 'utf8')
    return false
  }

  let gitIgnoreContents
  let ignorePatterns
  try {
    gitIgnoreContents = await readFileAsync(gitIgnorePath, 'utf8')
    ignorePatterns = parseIgnore.parse(gitIgnoreContents)
  } catch (error) {
    // ignore
  }
  /* Not ignoring .netlify folder. Add to .gitignore */
  if (!ignorePatterns || !ignorePatterns.patterns.some((pattern) => /(^|\/|\\)\.netlify($|\/|\\)/.test(pattern))) {
    const newContents = `${gitIgnoreContents}\n${ignoreContent}`
    await writeFileAsync(gitIgnorePath, newContents, 'utf8')
  }
}

module.exports = {
  parse,
  stringify,
  format: parseIgnore.format,
  ensureNetlifyIgnore,
}
