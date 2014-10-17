var webui = require("../helpers/webui");

exports.cmd = function(config, cmd) {
  config.getSite(cmd, function(site) {
    webui.open("/sites/" + site.name);
  });
}
