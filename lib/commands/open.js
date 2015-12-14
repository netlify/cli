var webui = require("../helpers/webui");

exports.cmd = function(config, cmd) {
  config.getSite(cmd).then(function(site) {
    webui.open("/sites/" + site.name);
  });
}
