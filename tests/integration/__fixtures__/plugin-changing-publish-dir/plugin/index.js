export default {
  onBuild({ netlifyConfig }) {
    netlifyConfig.build.publish = 'dist'
  },
}
