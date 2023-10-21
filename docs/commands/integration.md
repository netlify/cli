---
title: Netlify CLI integration command
description: Create, develop, and deploy integrations.
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
| [`integration:deploy`](/docs/commands/integration.md#integrationdeploy) | Register, build, and deploy a private integration on Netlify  |


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

<!-- AUTO-GENERATED-CONTENT:END -->
