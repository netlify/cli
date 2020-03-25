const TIMEOUT_IN_MILLIS = 20000;

const baseConfig = {
  authDomain: "netlify.firebaseapp.com",
  projectId: "firebase-netlify",
  storageBucket: "firebase-netlify.appspot.com",
  messagingSenderId: "344466503271"
};

const firebaseApps = {};

function loadFirebase(firebaseConfig) {
  const { databaseURL } = firebaseConfig;
  let app = firebaseApps[databaseURL];
  return app
    ? Promise.resolve(app)
    : Promise.all([
        require(/* webpackChunkName: "firebase" */ "firebase/app"),
        require(/* webpackChunkName: "firebase" */ "firebase/database")
      ]).then(([firebase, ...rest]) => {
        app = firebase.initializeApp(
          {
            ...baseConfig,
            ...firebaseConfig
          },
          databaseURL
        );
        firebaseApps[databaseURL] = app;
        return app;
      });
}

function logError(error) {
  console.error(error);
}

class FirebaseStreamer {
  constructor(attributes) {
    this.endpoint = attributes.endpoint;
    this.path = attributes.path.replace(/\./g, "-");
    this.startAt = attributes.startAt;
    this.token = attributes.accessToken;
  }

  listen(updater, errorHandler = logError) {
    let connected = false;

    setTimeout(() => {
      !connected && errorHandler(new Error("Connection timed out"));
    }, TIMEOUT_IN_MILLIS);

    let firebaseConfig = {
      apiKey: this.token,
      databaseURL: this.endpoint
    };
    loadFirebase(firebaseConfig).then(firebase => {
      this.api = firebase.database().ref(this.path);
      if (this.startAt) {
        this.api.orderByChild("ts").startAt(this.startAt);
      }
      this.api.on("child_added", snapshot => {
        // Called for every line in the log
        connected = true;
        updater(snapshot.val());
      });
      this.api.on("value", snapshot => {
        // Fallback for empty logs
        if (!connected) {
          connected = true;
          updater();
        }
      });
    });
  }

  close() {
    this.api && this.api.off && this.api.off();
  }
}

module.exports = FirebaseStreamer;
