export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow breaking changes with ! instead of requiring BREAKING CHANGE: footer
    'footer-max-line-length': [0],
  },
}
