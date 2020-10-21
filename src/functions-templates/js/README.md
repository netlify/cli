## note to devs

place new templates here and our CLI will pick it up. each template must be in its own folder.

## not a long term solution

we dont want people to update their CLI every time we add a template. see
https://github.com/netlify/netlify-dev-plugin/issues/42 for how we may solve in future

## template lifecycles

- onComplete
  - meant for messages, logging, light cleanup
- onAllAddonsInstalled?
  - not implemented yet
  - meant for heavier work, but not sure if different from onComplete

## template addons

specify an array of objects of this shape:

```ts
{
  addonName: String,
  addonDidInstall?: Function // for executing arbitrary postinstall code for a SINGLE addon
}
```

## why place templates in a separate folder

we dont colocate this inside `src/commands/functions` because oclif will think it's a new command.

every function should be registered with their respective `template-registry.js`.

## typescript and go

we have some templates here but they are unused for now until Netlify Dev supports them.
