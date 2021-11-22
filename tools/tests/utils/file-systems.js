const { join } = require('path')

const baseFiles = {
  'package.json': JSON.stringify({
    oclif: {
      commands: './src/commands',
    },
  }),
  'npm-shrinkwrap.json': '',
  'README.md': '',
}

const simpleMockedFileSystem = {
  [join('src/nested/a.js')]: `const b = require('./b');const asdf = require('asdf'); const {c} = require('../c');`,
  [join('src/nested/b.js')]: '',
  [join('src/c/index.js')]: `const d = require('../d');`,
  [join('src/d.js')]: '',
  [join('tests/a.test.js')]: `const a = require('../src/nested/a');`,
  [join('tests/c.test.js')]: `const a = require('../src/c');const u = require('./utils');`,
  [join('tests/utils.js')]: '',
  ...baseFiles,
}

const esModuleMockedFileSystem = {
  [join('src/nested/a.js')]: `import b from './b';import asdf from 'asdf'; import {c} from '../c';`,
  [join('src/nested/b.js')]: '',
  [join('src/c/index.js')]: `import * as d from '../d';`,
  [join('src/d.js')]: '',
  [join('tests/a.test.js')]: `import a from '../src/nested/a';`,
  [join('tests/c.test.js')]: `import a from '../src/c';import u from './utils';`,
  [join('tests/utils.js')]: '',
  ...baseFiles,
}

const callCliMockedFileSystem = {
  [join('src/commands/dev.js')]: `const {c} = require('../utils/c');`,
  [join('src/commands/build/index.js')]: `const {c} = require('../../utils/c');`,
  [join('src/utils/c.js')]: '',
  [join('tests/a.test.js')]: ` `,
  [join('tests/c.test.js')]: ` `,
  ...baseFiles,
}

module.exports = { simpleMockedFileSystem, callCliMockedFileSystem, esModuleMockedFileSystem }
