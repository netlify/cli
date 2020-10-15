# CONTRIBUTING

Contributions are always welcome, no matter how large or small. Before contributing,
please read the [code of conduct](CODE_OF_CONDUCT.md).

## Development process

First fork and clone the repository. If you're not sure how to do this, please watch
[these videos](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github).

Run:

```bash
npm install
```

Tests are run with:

```bash
npm test
```

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
4. Ensure the test suite passes.
5. Make sure your code lints.

## Releasing

1. Install dependencies. `npm ci`.
2. `npm run release`.

## License

By contributing to Netlify Node Client, you agree that your contributions will be licensed
under its [MIT license](LICENSE).
