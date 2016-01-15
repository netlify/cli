var when   = require("when"),
    fn     = require("when/callbacks"),
    chalk  = require("chalk"),
    inquire = require("inquirer");

exports.withConfirmation = function(options) {
  if (options.skip) {
    return when.resolve(true);
  }
  return fn.call(inquire.prompt, [{
    name: "confirm",
    type: "confirm",
    message: options.msg || "Are you sure?",
  }]).then(function(answers) {
    if (answers.confirm) {
      return true;
    }
    process.exit(1);
  });
};

exports.withWarning = function(value, warning) {
  console.log("\n");
  console.log(chalk.bold("Warning: ") + warning);
  console.log("\n");

  return fn.call(inquire.prompt, {name: "continue", message: "Are you sure you want to continue?", type: "confirm"}).then(function(result) {
    if (result.continue) {
      return value;
    }
    process.exit(1);
  });
}
