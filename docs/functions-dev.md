---
title: Developing functions with Netlify CLI
---

# Serving functions locally

With the `netlify dev` command you can simulate the Netlify production environment.
`netlify dev` starts a framework server if it detects one, handles redirects, proxy rules, functions and addons.

However, when developing functions locally, it can be useful to simulate Netlify Functions in a standalone server.
That allows easier debugging and doesn't have the overhead of starting a framework server.

## Usage

- Install the latest `npm install -g netlify-cli`.
- Run `netlify functions:serve` to start the functions server.

Your function will be available at `http://localhost:9999/.netlify/functions/<function-name>`

By default the server serves functions from the configured functions directory, or `netlify/functions` if a functions directory is not configured. The default port for the functions server is `9999`.
To override these settings you can use the `--functions` and `--port` flags:

```sh
netlify functions:serve --functions <path-to-dir> --port <port>
```

or by configuring them via the `netlify.toml` dev block:

```toml
[dev]
functions = "netlify-functions"
functionsPort = 7000
```

## Debugging functions

Netlify CLI uses [Lambda-local](https://github.com/ashiina/lambda-local) to simulate serverless functions.
Since the CLI invokes functions in the same process as the functions server, you can debug functions by inspecting the functions server process.
To do so set the `--inspect` Node.js option when starting the functions server:

- On Windows run `cmd /V /C "set NODE_OPTIONS=--inspect && netlify functions:serve"`
- On Mac/Linux run `NODE_OPTIONS=--inspect netlify functions:serve`

Then attach any Node.js debugger to the CLI process to debug your functions.


## VS Code Debugging

Put the below configuration in your repo's `.vscode/launch.json`.

Then in `VS Code`:
1. Open `Run and Debug` Sidebar. Make sure "Caught Exceptions" is deactivated.
2. In the dropdown, select `Fullstack Debugging`
3. Run the debugger. A chrome window should open. Wait until content is loaded (may take a few seconds for server to be ready).

```jsonc
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  // ---- FULLSTACK NETLIFY DEV DEBUGGING ----
  // 1. Make sure "Caught Exceptions" is deactivated in your VS Code debugger
  // 2. Run 'Fullstack Debugging' from the debug interface
  // 3. A chrome browser window will open, however it may take a few seconds
  // before the server is ready and content is displayed.
  "compounds": [
    {
      "name": "Fullstack Debugging",
      "configurations": ["netlify dev", "client: chrome"]
    }
  ],
  "configurations": [
    {
      "name": "client: chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:8888",
      "webRoot": "${workspaceFolder}",
      "sourceMapPathOverrides": {
        "webpack:///*": "${workspaceRoot}/*"
      }
    },
    {
      "name": "netlify dev",
      "type": "node",
      "request": "launch",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/node_modules/.bin/netlify",
      "args": ["dev", "--inspect"],
      "resolveSourceMapLocations": [
        // NOTE: your linter may think this property shouldn't be here
        // yet it works for finding the source maps
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ]
    }
  ]
}
```

**IMPORTANT**

> Make sure you have deactivated "Caught Exceptions" in VS Code debugger, otherwise you might catch internal node.js or other wrapping processes errors.

### Full Example
A guide with a full debugging example can be found here: [Minimal Reproducible Example for Netlify dev debug with VS code](https://github.com/MentalGear/netlify-dev_debug_vs-code)
