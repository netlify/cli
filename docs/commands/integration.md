---
title: Netlify CLI integration command
description: (Beta) Create, develop, and deploy integrations.
---

# `integration`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Manage integrations

**Usage**

```bash
netlify integration
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`integration:build`](/docs/commands/integration.md#integrationbuild) | Builds the Netlify integration.  |
| [`integration:deploy`](/docs/commands/integration.md#integrationdeploy) | Register, build and deploy a private Netlify integration.  |
| [`integration:dev`](/docs/commands/integration.md#integrationdev) | Build and preview the Netlify integration in your local environment.  |
| [`integration:init`](/docs/commands/integration.md#integrationinit) | Creates a skeleton Netlify integration project in your current directory.  |
| [`integration:preview`](/docs/commands/integration.md#integrationpreview) |   |


---
## `integration:build`

Builds the Netlify integration.

**Usage**

```bash
netlify integration:build
```

**Flags**

- `all` (*boolean*) - Build all components of the integration
- `buildtime` (*boolean*) - Build the build time component of the integration
- `connector` (*boolean*) - Build the Netlify Connect plugin of the integration
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `site` (*boolean*) - Build the serverless component of the integration
- `watch` (*boolean*) - Build integration and then watch for changes
- `debug` (*boolean*) - Print debugging information

---
## `integration:deploy`

Register, build and deploy a private Netlify integration.

**Usage**

```bash
netlify integration:deploy
```

**Flags**

- `auth` (*string*) - Netlify auth token to deploy with
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `prod` (*boolean*) - Deploy to production
- `site` (*string*) - A site name or ID to deploy to
- `debug` (*boolean*) - Print debugging information

---
## `integration:dev`

Build and preview the Netlify integration in your local environment.

**Usage**

```bash
netlify integration:dev
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

---
## `integration:init`

Creates a skeleton Netlify integration project in your current directory.

**Usage**

```bash
netlify integration:init
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `slug` (*boolean*) - The integration slug.
- `debug` (*boolean*) - Print debugging information

---
## `integration:preview`



**Usage**

```bash
netlify integration:preview
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

---

<!-- AUTO-GENERATED-CONTENT:END -->
