var chalk = require("chalk"),
    confirm = require("../helpers/confirm");

exports.cmd = function(config, cmd) {
  config.getSite(cmd).then(function(site) {
    confirm.withConfirmation({msg: "Are you sure you want to delete this site?", skip: cmd.yes}).then(function() {
      site.destroy().then(function() {
        console.log("Site deleted");
        config.deleteLocalConfig();
      }).catch(function(err) {
        console.log("Error deleting site: " + chalk.bold(err));
        process.exit(1);
      });
    });
  });
}
