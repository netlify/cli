---
title: Netlify CLI integration command
description: (Beta) Create, develop, and deploy integrations.
---

# `integration`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Manage Netlify Integrations built with the Netlify SDK

**Usage**

```bash
netlify integration
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`integration:build`](/docs/commands/integration.md#integrationbuild) | Builds the integration  |
| [`integration:deploy`](/docs/commands/integration.md#integrationdeploy) | Register, build, and deploy a private integration on Netlify  |
| [`integration:dev`](/docs/commands/integration.md#integrationdev) | Build and preview the integration in your local environment  |
| [`integration:preview`](/docs/commands/integration.md#integrationpreview) |   |


---
## `integration:build`

Builds the integration

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

Register, build, and deploy a private integration on Netlify

**Usage**

```bash
netlify integration:deploy
```

**Flags**

- `auth` (*string*) - Netlify auth token to deploy with
- `build` (*boolean*) - Build the integration
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `prod` (*boolean*) - Deploy to production
- `site` (*string*) - A site name or ID to deploy to
- `debug` (*boolean*) - Print debugging information

---
## `integration:dev`

Build and preview the integration in your local environment

**Usage**

```bash
netlify integration:dev
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
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
