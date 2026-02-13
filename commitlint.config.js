export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)(?:\(([^)]*)\))?(!)?:\s(.+)$/,
      breakingHeaderPattern: /^(\w+)(?:\(([^)]*)\))?(!)?:\s(.+)$/,
      headerCorrespondence: ['type', 'scope', 'breaking', 'subject'],
      issuePrefixes: ['#'],
    },
  },
}
