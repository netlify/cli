const chalk = require('chalk');

function starting({ host, port }) {
  process.stdout.write(`Waiting for ${host}:${port}`);
}

function tryConnect() {
  process.stdout.write('.');
}

function connected() {
  console.log(chalk.green('\nConnected!'));
}

function timeout() {
  console.log(chalk.red('\nTimeout'));
}

function error(err) {
  process.stdout.write(chalk.red(` error: ${err}.`));
}

module.exports = {
  starting,
  tryConnect,
  connected,
  timeout,
  error
};
