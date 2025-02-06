import type { OnBuild } from '@netlify/build'

export const onBuild: OnBuild = async ({ constants }) => {
  console.log(`@@ packagePath: ${constants.PACKAGE_PATH}`)
  console.log(`@@ cwd: ${process.cwd()}`)
}
