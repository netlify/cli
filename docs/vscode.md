---
title: Debugging with Visual Studio Code
---

# Run and debug with Visual Studio Code

This guide will walk you through configuring VScode to run and debug `netlify dev`.
This allows debugging your site and serverless functions all in the same IDE.

## Install Netlify CLI locally

Install Netlify CLI as a local dev dependency:

```bash
npm install --save-dev netlify-cli
```

or

```bash
yarn add -D netlify-cli
```

## Add VSCode launch configurations

Create a `launch.json` file under a `.vscode` directory in your project with the following content.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "netlify dev",
      "type": "node",
      "request": "launch",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/node_modules/.bin/netlify",
      "args": ["dev"],
      "console": "integratedTerminal",
      "env": { "BROWSER": "none" },
      "serverReadyAction": {
        "pattern": "Server now ready on (https?://[\\w:.-]+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    },
    {
      "name": "netlify functions:serve",
      "type": "node",
      "request": "launch",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/node_modules/.bin/netlify",
      "args": ["functions:serve"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Debugging

1. Click `Run and Debug` from the VSCode sidebar. **Make sure "Caught Exceptions" is deactivated to reduce noise.**
2. In the dropdown, select either`netlify dev` or `netlify functions:serve`.
3. Run the debugger.

- `netlify dev` will start an entire local development environment and open a browser with the site URL
- `netlify functions:serve` will start a [standalone Netlify Functions server](./functions-dev)
