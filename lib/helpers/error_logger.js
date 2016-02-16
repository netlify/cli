var chalk = require("chalk");

exports.log = function(prefix, error) {
  console.log(error);
  var msg;
  if (typeof error === 'string') {
    msg = error;
  } else if(error.message) {
    msg = error.message;
  } else if(error.data) {
    var data = JSON.parse(error.data);
    msg = data && data.message || data;
  } else {
    msg = error.toString();
  }

  console.log(prefix, chalk.bold(msg));
}
