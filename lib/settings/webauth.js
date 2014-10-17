var chalk = require("chalk"),
    webui = require("../helpers/webui");

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


exports.login = function(options, cb) {
  options.client.createTicket(function(err, ticket) {
    if (err) {
      console.log("Error generating authorization ticket: %s", err);
      process.exit(1);
    }

    webui.open("/authorize?response_type=ticket&ticket=" + ticket.id, function() {
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
