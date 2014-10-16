var chalk = require("chalk"),
    confirm = require("../helpers/confirm");



exports.cmd = function(config, cmd) {
  config.getSite(cmd, function(site) {
    confirm.withConfirmation({msg: "Are you sure you want to delete this site?", skip: cmd.yes}, function() {
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
