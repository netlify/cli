---
title: Netlify CLI deploy command
---

# `deploy`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Create a new deploy from the contents of a folder

Deploys from the build settings found in the netlify.toml file, or settings from the API.

The following environment variables can be used to override configuration file lookups and prompts:

- `NETLIFY_AUTH_TOKEN` - an access token to use when authenticating commands. Keep this value private.
- `NETLIFY_SITE_ID` - override any linked site in the current working directory.

Lambda functions in the function folder can be in the following configurations for deployment:


Built Go binaries:
------------------

```
functions/
└── nameOfGoFunction
```

Build binaries of your Go language functions into the functions folder as part of your build process.


Single file Node.js functions:
-----------------------------

Build dependency bundled Node.js lambda functions with tools like netlify-lambda, webpack or browserify into the function folder as part of your build process.

```
functions/
└── nameOfBundledNodeJSFunction.js
```

Unbundled Node.js functions that have dependencies outside or inside of the functions folder:
---------------------------------------------------------------------------------------------

You can ship unbundled Node.js functions with the CLI, utilizing top level project dependencies, or a nested package.json.
If you use nested dependencies, be sure to populate the nested node_modules as part of your build process before deploying using npm or yarn.

```
project/
├── functions
│   ├── functionName/
│   │   ├── functionName.js  (Note the folder and the function name need to match)
│   │   ├── package.json
│   │   └── node_modules/
│   └── unbundledFunction.js
├── package.json
├── netlify.toml
└── node_modules/
```

Any mix of these configurations works as well.


Node.js function entry points
-----------------------------

Function entry points are determined by the file name and name of the folder they are in:

```
functions/
├── aFolderlessFunctionEntrypoint.js
└── functionName/
    ├── notTheEntryPoint.js
    └── functionName.js
```

Support for package.json's main field, and intrinsic index.js entrypoints are coming soon.


**Usage**

```bash
netlify deploy
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `dir` (*option*) - Specify a folder to deploy
- `functions` (*option*) - Specify a functions folder to deploy
- `prod` (*boolean*) - Deploy to production
- `alias` (*option*) - Specifies the alias for deployment. Useful for creating predictable deployment URL's
- `branch` (*option*) - Serves the same functionality as --alias. Deprecated and will be removed in future versions
- `open` (*boolean*) - Open site after deploy
- `message` (*option*) - A short message to include in the deploy log
- `auth` (*option*) - Netlify auth token to deploy with
- `site` (*option*) - A site ID to deploy to
- `json` (*boolean*) - Output deployment data as JSON
- `timeout` (*option*) - Timeout to wait for deployment to finish
- `trigger` (*boolean*) - Trigger a new build of your site on Netlify without uploading local files

**Examples**

```bash
netlify deploy
netlify deploy --prod
netlify deploy --prod --open
netlify deploy --message "A message with an $ENV_VAR"
netlify deploy --auth $NETLIFY_AUTH_TOKEN
netlify deploy --trigger
```


<!-- AUTO-GENERATED-CONTENT:END -->
