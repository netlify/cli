---
title: Debugging
---

# Debugging

- ## Using node --inspect

  Netlify CLI uses [Lambda-local](https://github.com/ashiina/lambda-local) to simulate serverless functions.
  Since the CLI invokes functions in the same process as the functions server, you can debug functions by inspecting the functions server process.
  To do so set the `--inspect` Node.js option when starting the functions server:

  - On Windows run `cmd /V /C "set NODE_OPTIONS=--inspect && netlify functions:serve"`
  - On Mac/Linux run `NODE_OPTIONS=--inspect netlify functions:serve`

  Then attach any Node.js debugger to the CLI process to debug your functions.


- ## Using VS Code Debug

  Alternatively you can use `vscode`'s debug mode to inspect both backend (netlify functions) as well as frontend functionality.

  ### 1. Setup
  Install Netlify CLI as a local dev dependency:
  ```bash
  npm install --save-dev netlify-cli
  ```
  or
  ```bash
  yarn add -D netlify-cli
  ```

  ### 2. Config
  Choose a setup and put that configuration in your repo's `.vscode/launch.json`.

    - #### Functions Debug Only
      ```jsonc
      {
        // https://go.microsoft.com/fwlink/?linkid=830387
        "version": "0.2.0",
        // ---- NETLIFY FUNCTIONS DEBUG ----
        "configurations": [
          {
            "name": "netlify dev",
            "type": "node",
            "request": "launch",
            "skipFiles": ["<node_internals>/**"],
            "program": "${workspaceFolder}/node_modules/.bin/netlify",
            "args": ["dev"],
            "console": "integratedTerminal", // important to show all errors`
            "resolveSourceMapLocations": [
              // NOTE: your linter may think this property shouldn't be here
              // yet it works for finding the source maps
              "${workspaceFolder}/**",
              "!**/node_modules/**"
            ]
          }
        ]
      }```
 
  - #### Fullstack Debug (Frontend & Backend Functions)
    ```jsonc
    {
      // https://go.microsoft.com/fwlink/?linkid=830387
      "version": "0.2.0",
      // ---- FULLSTACK NETLIFY DEV DEBUGGING ----
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
          "args": ["dev"],
          "console": "integratedTerminal", // important to show all errors`
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


  ### 3. Running Debug

  `VS Code`:
  1. Open `Run and Debug` Sidebar. Make sure "Caught Exceptions" is deactivated.
  2. In the dropdown, select:`netlify dev` or `Fullstack Debugging`
  3. Run the debugger. For `Fullstack Debugging` a chrome window should open. Wait until content is loaded (may take a few seconds for server to be ready).

  **IMPORTANT**

  > Make sure you have deactivated "Caught Exceptions" in VS Code debugger, otherwise you might catch internal node.js or other wrapping processes errors.

  ### Full Example
  A guide with a full debugging example can be found here: [Minimal Reproducible Example for Netlify dev debug with VS code](https://github.com/MentalGear/netlify-dev_debug_vs-code)
