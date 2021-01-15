# Contributions

🎉 Thanks for considering contributing to this project! 🎉

These guidelines will help you send a pull request.

If you're submitting an issue instead, please skip this document.

If your pull request is related to a typo or the documentation being unclear, please click on the relevant page's `Edit`
button (pencil icon) and directly suggest a correction instead.

This project was made with ❤️. The simplest way to give back is by starring and sharing it online.

Everyone is welcome regardless of personal background. We enforce a [Code of conduct](CODE_OF_CONDUCT.md) in order to
promote a positive and inclusive environment.

## Development process

First fork and clone the repository. If you're not sure how to do this, please watch
[these videos](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github).

Run:

```bash
npm install && npm run site:build:install
```

Tests are run with:

```bash
npm test
```

**NOTE:** we run some integration tests against an active Netlify account. For these tests to pass you'll need to
provide a Netlify auth token (using the `NETLIFY_AUTH_TOKEN` environment variable) or login via `./bin/run login` before
running the tests.

In watch mode:

```bash
npm run watch
```

Make sure everything is correctly setup by running those tests first.

ESLint and Prettier are performed automatically on `git push`. However, we recommend you setup your IDE or text editor
to run ESLint and Prettier automatically on file save. Otherwise, you should run them manually using:

```bash
npm run format
```

Alternatively you can setup your IDE to integrate with Prettier and ESLint for JavaScript and Markdown files.

To run the CLI locally:

```bash
./bin/run [command]
```

## Architecture

The CLI is written using the [oclif](https://oclif.io/) cli framework and the [netlify/js-client](https://github.com/netlify/js-client) open-api derived API client.

- Commands live in the [`src/commands`](src/commands) folder.
- The base command class which provides consistent config loading and an API client lives in [`src/base`](src/base).
- Small utilities and other functionality live in [`src/utils`](src/utils).

A good place to start is reading the base command README and looking at the commands folder.

### Testing

This repo uses [ava](https://github.com/avajs/ava) for testing. Any files in the `src` directory that have a `.test.js` file extension are automatically detected and run as tests.

We also test for a few other things:

- Dependencies (used an unused)
- Linting
- Test coverage
- Must work with Windows + Unix environments.

## Pull Requests

We actively welcome your pull requests.

1. Fork the repo and create your branch from `master`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Run `npm test` to run linting, formatting and tests.
5. Make sure to sync the docs by running `npm run docs`.

## Releasing

1. Merge the release PR
2. Switch to the default branch `git checkout master`
3. Pull latest changes `git pull`
4. Publish the package `npm publish`

## License

By contributing to Netlify Node Client, you agree that your contributions will be licensed
under its [MIT license](LICENSE).
