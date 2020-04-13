## writing a detector

- write as many checks as possible to fit your project
- return false if its not your project
- if it definitely is, return an object with this shape:

```ts
{
    framework: String, // e.g. gatsby, vue-cli
    command: String, // e.g. yarn, npm
    port: Number, // e.g. 8888
    proxyPort: Number, // e.g. 3000
    env: Object, // env variables, see examples
    possibleArgsArrs: [[String]], // e.g [['run develop]], so that the combined command is 'npm run develop', but we allow for multiple
    urlRegexp: RegExp, // see examples
    dist: String, // static folder where a _redirect file would be placed, e.g. 'public' or 'static'. NOT the build output folder
}
```

## things to note

- Dev block overrides will supercede anything you write in your detector: https://github.com/netlify/cli/blob/master/docs/netlify-dev.md#project-detection
- detectors are language agnostic. don't assume npm or yarn.
- if default args (like 'develop') are missing, that means the user has configured it, best to tell them to use the -c flag.

## detector notes

- metalsmith is popular but has no dev story so we have skipped it
- hub press doesnt even have cli https://github.com/HubPress/hubpress.io#what-is-hubpress
- gitbook:

not sure if we want to support gitbook yet

requires a global install: https://github.com/GitbookIO/gitbook/blob/master/docs/setup.md

```js
const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['README.md', 'SUMMARY.md'])) return false
  // // REQUIRED DEPS
  // if (!hasRequiredDeps(["hexo"])) return false;

  /** everything below now assumes that we are within gatsby */

  const possibleArgsArrs = [['gitbook', 'serve']]
  // scanScripts({
  //   preferredScriptsArr: ["start", "dev", "develop"],
  //   preferredCommand: "hexo server"
  // });

  return {
    framework: 'gitbook',
    command: getYarnOrNPMCommand(),
    port: 8888,
    proxyPort: 4000,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${4000}(/)?`, 'g'),
    dist: 'public'
  }
}
```
