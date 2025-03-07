const admin = require("firebase-admin");
const serviceAccount = require("../../secrets/serviceAccountkey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;


