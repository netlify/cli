const js = require('./js')

// A runtime must adhere to the following interface:
//
// getBuildFunction: ({
//   config,
//   errorExit,
//   func,
//   functionsDirectory,
//   projectRoot
// }) => Promise<(func) => Promise<({ srcFiles, ...buildData })>>
//
// - Returns a callback that prepares a function for invocation. This callback
//   receives a function and returns an object with the source files associated
//   with the function as well as additional metadata needed by the runtime.
//
// invokeFunction: ({
//   context,
//   event,
//   func,
//   timeout
// }) => Promise<({ body, statusCode })>
//
// - Invokes the function and returns the resulting body and status code.
//
// name: string
//
//  - Holds the name of the runtime, compatible with the `runtime` property
//    used in the output of zip-it-and-ship (e.g. "js", "go").

const runtimes = [js].reduce((res, runtime) => ({ ...res, [runtime.name]: runtime }), {})

module.exports = runtimes
