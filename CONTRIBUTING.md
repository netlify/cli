# Contributions

🎉 Thanks for considering contributing to this project! 🎉

These guidelines will help you send a pull request.

If you’re submitting an issue instead, please skip this document..

This project was made with ❤️. The simplest way to give back is by starring and sharing it online.

Everyone is welcome regardless of personal background. We enforce a [Code of conduct](CODE_OF_CONDUCT.md) in order to
promote a positive and inclusive environment.

## Table of Contents

- [Developing locally](#developing-locally)
  - [Architecture](#architecture)
  - [Adding or updating a command](#adding-or-updating-a-command)
  - [Updating our documentation](#updating-our-documentation)
  - [Testing](#testing)
    - [Debugging tests](#debugging-tests)
  - [Lint docs per Netlify style guide](#lint-docs-per-netlify-style-guide)
- [Pull Requests](#pull-requests)
- [Releasing](#releasing)
- [License](#license)

## Developing locally

First, fork and clone the repository. If you’re not sure how to do this, please watch
[these videos](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github).

Run:

```bash
npm install
npm run build
```

Tests are run with:

```bash
npm test
```

**NOTE:**

In order to run all tests, make sure to have [Git LFS](https://git-lfs.github.com/) installed on your system.

Running some integration tests requires an active Netlify account to create a live site.

You can either provide a
[Netlify Auth Token](https://docs.netlify.com/cli/get-started/#obtain-a-token-in-the-netlify-ui) (through the
`NETLIFY_AUTH_TOKEN` environment variable) or login via `./bin/run.js login` before running the tests.

The tests don't count towards Netlify build minutes since they build a site locally and deploy it using the API.

**For Netlify employees**, our CI uses a Netlify Auth Token from a
[`netlify services` account](https://app.netlify.com/teams/netlify-services/sites). Credentials for the account are in
1Password.

In watch mode:

```bash
npm run watch
```

Make sure everything is correctly set up by running those tests first.

We recommend you set up your IDE or text editor to run ESLint and Prettier automatically on file save. Otherwise, you
can run them manually using:

```bash
npm run format
npm run lint:fix
```

To run the CLI locally:

```bash
./bin/run.js [command]
```

or (`DEBUG=true` enables printing stack traces when errors are thrown):

```bash
DEBUG=true ./bin/run.js [command]
```

### Attaching a Debugger

When debugging a project, it's super helpful to attach a debugger to the CLI. If you use VS Code, here's how you can do
it:

1. Open this repository in VS Code.
2. Open a "JavaScript Debug Terminal" (e.g. by searching for it in the Command Palette (Shift-Cmd+P)). Every Node
   process that's opened in this terminal will have a debugger attached.
3. Place a breakpoint somewhere in the CLI. You will have to place them in the compiled `.js` files as opposed to the
   `.ts` files.
4. In your JavaScript Debug Terminal, navigate to the project you'd like to debug.
5. Run `/path/to/netlify/cli/bin/run.js`. The debugger should be connecting automatically.

### Architecture

The CLI is written using the [commander.js](https://github.com/tj/commander.js/) cli interface and the
[netlify/js-client](https://github.com/netlify/js-client) open-api derived API client.

- Commands live in the [`src/commands`](src/commands) folder.
- The base command class which provides consistent config loading and an API client lives in
  [`src/commands/base-command.js`](src/commands/base-command.js).
- Small utilities and other functionality live in [`src/utils`](src/utils).

A good place to start is reading the base command README and looking at the commands folder.

> If you’d like to learn more on how `netlify dev` works, check [here](./docs/netlify-dev.md)

### Adding or updating a command

If you're adding a new command or updating an existing one, make sure to also add docs for it by running `npm run docs`.

This will automatically generate documentation for you that will look like the following:

```md
---
title: Netlify CLI [command name] command
description: A description.
---

# `command name`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->

<!-- AUTO-GENERATED-CONTENT:END -->
```

When adding a new command, you will also need to add it to the nav sidebar manually by adding it to the `navOrder` array
in `site/src/_app.js`

### Updating our documentation

If documentation looks to be out of date, it is likely that the code for the command itself is not correct.

To update the documentation, update the code (rather than the markdown files) and then run `npm run docs` to sync the
docs. To confirm that the changes to the docs are correct, run `cd site && npm run dev:start` to run the docs locally.

### Testing

This repo uses [vitest](https://github.com/vitest-dev/vitest) for testing. Unit tests are in the `tests/unit` folder and
integration tests are in the `tests/integration` folder. We use this convention since we split tests across multiple CI
machines to speed up CI time. You can read about it more [here](https://github.com/netlify/cli/issues/4178).

We also test for a few other things:

- Dependencies (used and unused)
- Linting
- Test coverage
- Must work with Windows + Unix environments.

#### Debugging tests

To run a single test file you can do:

```
npm exec vitest -- run tests/unit/tests/unit/lib/account.test.js
```

To run a single test you can either use `test.only` inside the test file and ran the above command or run this:

```
npm exec vitest -- run tests/unit/tests/unit/lib/account.test.js -t 'test name'
```

Some of the tests actually start the CLI in a subprocess and therefore sometimes underlying errors are not visible in
the tests when they fail. By default the output of the subprocess is not forwarded to the main process to keep the cli
output clean. To debug test failures like this you can set the environment variable `DEBUG_TESTS=true` and the
subprocess will pipe it's output to the main process for you to see.

When `DEBUG_TESTS` is set the vitest reporter will be set to `tap` so the test output won't interfere with the debug
output.

```
DEBUG_TESTS=true npm exec vitest -- run tests/unit/tests/unit/lib/account.test.js -t 'test name'
```

### Lint docs per Netlify style guide

1. [Install vale](https://docs.errata.ai/vale/install)
2. Download the latest styles to the styles directory. For example:
   `wget -q -O styles.zip https://vale-library.netlify.app/styles.zip && unzip styles.zip -d .github/styles && rm styles.zip`
3. Run vale: `vale docs src README.md CODE_OF_CONDUCT.md CONTRIBUTING.md`

## Pull Requests

We actively welcome your pull requests.

1. Fork the repo and create your branch from `main`.
2. If you’ve added code that should be tested, add tests.
3. If you’ve changed APIs, update the documentation.
4. Run `npm test` to run linting, formatting and tests.
5. Make sure to sync the docs by running `npm run docs`.

## Releasing

Tag the 'release' pull request using the `automerge` label. This will merge the pull request on GitHub and publish the
package to npm.

### Creating a prerelease

1. Create a branch named `releases/<tag>/<version>` with the version and tag you’d like to release.
2. Push the branch to the repo.

For example, a branch named `releases/rc.0/4.0.0` will create the version `4.0.0-rc.0` and publish it under the `rc.0`
tag.

## License

By contributing to Netlify Node Client, you agree that your contributions will be licensed under its
[MIT license](LICENSE).
