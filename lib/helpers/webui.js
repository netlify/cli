var when  = require("when"),
    join  = require("path").join,
    open  = require("open"),
    chalk = require("chalk");

var WEBUI = process.env.NETLIFY_WEB_UI || "https://app.netlify.com";

exports.open = function(path) {
  var url = WEBUI + join("", path),
      p   = open(url);

  return when.promise(function(resolve, reject) {
    p.on('exit', function(code) {
      if (parseInt(code) > 0) {
        console.log("Please visite this authentication URL in your browser:\n  " + chalk.bold(url));
      }
      else {
        console.log('Opening ' + chalk.bold(url));
      }

      resolve(code);
    });
  });
}
