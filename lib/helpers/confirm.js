var when   = require("when"),
    fn     = require("when/callbacks"),
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
