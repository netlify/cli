var chalk = require("chalk"),
    open  = require("open");

var waitForTicket = function(ticket, waitUntil, cb) {
  if (waitUntil && new Date() > waitUntil) {
    return cb("Timeout");
  }

  if (ticket.authorized) {
      process.nextTick(function() { cb(null, ticket); });
  } else {
    setTimeout(function() {
      ticket.refresh(function(err) {
        if (err) return cb(err);
        waitForTicket(ticket, waitUntil, cb);
      });
    }, 5000);
  }
};


var openOrPrompt = function(url, cb) {
  var p = open(url);

  p.on('exit', function(code) {
    if (parseInt(code) > 0) {
      console.log("Please visite this authentication URL in your browser:\n  " + chalk.bold(url));
    }
    else {
      console.log('Opening ' + chalk.bold(url));
    }

    cb(code);
  });
}

exports.login = function(options, cb) {
  options.client.createTicket(function(err, ticket) {
    if (err) {
      console.log("Error generating authorization ticket: %s", err);
      process.exit(1);
    }

    openOrPrompt(options.webui + "/authorize?response_type=ticket&ticket=" + ticket.id, function() {
      var ts = new Date();
      ts.setHours(ts.getHours() + 1);
      waitForTicket(ticket, ts, function(err, ticket) {
        if (err) {
          console.log("Error while waiting for authorization: %s", err);
          process.exit(1);
        }
        ticket.exchange(function(err, token) {
          if (err) {
            console.log("Error while authorizing: %s", err);
            process.exit(1);
          }

          cb(null, token);
        });
      });
    });
  });
}
