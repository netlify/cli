var prompt = require("prompt"),
    chalk = require("chalk");

var withConfirmation = function(cmd, cb) {
  if (cmd.yes) {
    cb()
  } else {
    prompt.start();
    prompt.get({properties: {deleteSite: {
      type: "string",
      description: "Are you sure you want to delete this site (yes/no)?",
      pattern: /^yes|no$/,
      message: "Please answer yes or no",
      required: true,
      default: "no"
    }}}, function(err, result) {
      if (result && result.deleteSite == "yes") {
        cb();
      } else {
        process.exit(1);
      }
    });
  }
};

exports.cmd = function(config, cmd) {
  config.getSite(cmd, function(site) {
    withConfirmation(cmd, function(){
      site.destroy(function(err) {
        if (err) {
          console.log("Error deleting site: " + chalk.bold(err));
          process.exit(1);
        }

        console.log("Site deleted");
        config.deleteLocalConfig();
      });
    });
  });
}
