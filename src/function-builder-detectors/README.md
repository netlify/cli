## function builder detectors

similar to project detectors, each file here detects function builders. this is so that netlify dev never manages the webpack or other config. the expected output is very simple:

```js
module.exports = {
  src: 'functions-source', // source for your functions
  build: () => {}, // chokidar will call this to build and rebuild your function
  npmScript: 'build:functions' // optional, the matching package.json script that calls your function builder
}
```

example

- [src](https://github.com/netlify/cli/blob/f7b7c6adda3903fa02cf1b3fadcef026a4e56c13/src/function-builder-detectors/netlify-lambda.js#L22)
- [npmScript](https://github.com/netlify/cli/blob/f7b7c6adda3903fa02cf1b3fadcef026a4e56c13/src/function-builder-detectors/netlify-lambda.js#L23)
