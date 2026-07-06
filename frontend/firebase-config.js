const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();
const storage = firebase.storage();
const functions = firebase.functions();

db.settings({ experimentalForceLongPolling: true });

window.WIP = window.WIP || {};
window.WIP.auth = auth;
window.WIP.db = db;
window.WIP.rtdb = rtdb;
window.WIP.storage = storage;
window.WIP.functions = functions;