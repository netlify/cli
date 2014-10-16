var prompt = require("prompt");

exports.withConfirmation = function(options, cb) {
  if (options.skip) {
    cb()
  } else {
    prompt.start();
    prompt.get({properties: {confirm: {
      type: "string",
      description: (options.msg || "Are you sure?") + " (yes/no)",
      pattern: /^yes|no$/,
      message: "Please answer yes or no",
      required: true,
      default: options.default || "no"
    }}}, function(err, result) {
      if (result && result.confirm == "yes") {
        cb();
      } else {
        process.exit(1);
      }
    });
  }
};
