---
title: Netlify CLI deploy command
---

# `deploy`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Create a new deploy from the contents of a folder

Deploys from the build settings found in the netlify.toml file, or settings from the api.

The following environment variables can be used to override configuration file lookups and prompts:

- `NETLIFY_AUTH_TOKEN` - an access token to use when authenticating commands. KEEP THIS VALUE PRIVATE
- `NETLIFY_SITE_ID` - override any linked site in the current working directory.


**Usage**

```bash
netlify deploy
```

**Flags**

- `dir` (*option*) - Specify a folder to deploy
- `functions` (*option*) - Specify a functions folder to deploy
- `prod` (*boolean*) - Deploy to production
- `open` (*boolean*) - Open site after deploy
- `message` (*option*) - A short message to include in the deploy log
- `auth` (*option*) - An auth token to log in with
- `site` (*option*) - A site ID to deploy to

**Examples**

```bash
netlify deploy
netlify deploy --prod
netlify deploy --prod --open
netlify deploy --message "A message with an $ENV_VAR"
```


<!-- AUTO-GENERATED-CONTENT:END -->
