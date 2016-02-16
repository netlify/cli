var confirm = require("../helpers/confirm"),
    errorLogger = require("../helpers/error_logger");

exports.cmd = function(config, cmd) {
  config.getSite(cmd).then(function(site) {
    confirm.withConfirmation({msg: "Are you sure you want to delete this site?", skip: cmd.yes}).then(function() {
      site.destroy().then(function() {
        console.log("Site deleted");
        config.deleteLocalConfig();
      }).catch(function(err) {
        errorLogger.log("Error deleting site: ", err);
        process.exit(1);
      });
    });
  });
}
