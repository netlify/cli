# Contributions

🎉 Thanks for considering contributing to this project! 🎉

These guidelines will help you send a pull request.

If you're submitting an issue instead, please skip this document.

If your pull request is related to a typo or the documentation being unclear, please click on the relevant page's `Edit`
button (pencil icon) and directly suggest a correction instead.

This project was made with ❤️. The simplest way to give back is by starring and sharing it online.

Everyone is welcome regardless of personal background. We enforce a [Code of conduct](CODE_OF_CONDUCT.md) in order to
promote a positive and inclusive environment.

## Setup

Install Node.js 8+ on your system: https://nodejs.org/en/download/

1. Clone down the repo

```sh-session
$ git clone git@github.com:netlify/cli.git
```

2. Install dependencies

```sh-session
$ npm install
```

3. Run CLI locally during development

```sh-session
$ ./bin/run [command]
```

When developing, you can use watch mode which will automatically run ava tests:

```sh-session
$ npm run watch
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
