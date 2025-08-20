---
title: Netlify CLI deploy command
sidebar:
  label: deploy
---

# `deploy`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Deploy your project to Netlify

Builds and deploys your project to Netlify. Creates a draft deploy by default.
Use --prod to deploy directly to your live site.

The deploy command will:
- Build your project (unless --no-build is specified)
- Upload static files, functions, and edge functions
- Process redirects and headers from netlify.toml or _redirects/_headers files
- Provide deploy and function logs URLs

For detailed configuration options, see the Netlify documentation.

**Usage**

```bash
netlify deploy
```

**Flags**

- `alias` (*string*) - Specifies the alias for deployment, the string at the beginning of the deploy subdomain. Useful for creating predictable deployment URLs. Avoid setting an alias string to the same value as a deployed branch. `alias` doesn’t create a branch deploy and can’t be used in conjunction with the branch subdomain feature. Maximum 37 characters.
- `context` (*string*) - Specify a deploy context for environment variables read during the build (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)
- `create-site` (*string*) - Create a new site and deploy to it. Optionally specify a name, otherwise a random name will be generated. Requires --team flag if you have multiple teams.
- `dir` (*string*) - Specify a folder to deploy
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `functions` (*string*) - Specify a functions folder to deploy
- `json` (*boolean*) - Output deployment data as JSON
- `message` (*string*) - A short message to include in the deploy log
- `no-build` (*boolean*) - Do not run build command before deploying. Only use this if you have no need for a build or your project has already been built.
- `open` (*boolean*) - Open project after deploy
- `prod-if-unlocked` (*boolean*) - Deploy to production if unlocked, create a draft otherwise
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `prod` (*boolean*) - Deploy to production
- `site` (*string*) - A project name or ID to deploy to
- `skip-functions-cache` (*boolean*) - Ignore any functions created as part of a previous `build` or `deploy` commands, forcing them to be bundled again as part of the deployment
- `team` (*string*) - Specify team slug when creating a site. Only works with --create-site flag.
- `timeout` (*string*) - Timeout to wait for deployment to finish
- `trigger` (*boolean*) - Trigger a new build of your project on Netlify without uploading local files

**Examples**

```bash
netlify deploy
netlify deploy --site my-first-project
netlify deploy --no-build # Deploy without running a build first
netlify deploy --prod
netlify deploy --prod --open
netlify deploy --prod-if-unlocked
netlify deploy --message "A message with an $ENV_VAR"
netlify deploy --auth $NETLIFY_AUTH_TOKEN
netlify deploy --trigger
netlify deploy --context deploy-preview
netlify deploy --create-site my-new-site --team my-team # Create site and deploy
```


<!-- AUTO-GENERATED-CONTENT:END -->
