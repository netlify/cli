var join = require("path").join,
    open  = require("open"),
    chalk = require("chalk");

var WEBUI = process.env.NETLIFY_WEB_UI || "https://app.netlify.com";

exports.open = function(path, cb) {
  var url = join(WEBUI, path),
      p   = open(url);

  p.on('exit', function(code) {
    if (parseInt(code) > 0) {
      console.log("Please visite this authentication URL in your browser:\n  " + chalk.bold(url));
    }
    else {
      console.log('Opening ' + chalk.bold(url));
    }

    cb && cb(code);
  });
}
