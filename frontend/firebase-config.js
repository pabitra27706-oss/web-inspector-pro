// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAlzBbVziZm-tgy3XvtJ9Rj0GQ1DZyqyPA",
  authDomain: "web-inspector-pro-52414.firebaseapp.com",
  databaseURL: "https://web-inspector-pro-52414-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "web-inspector-pro-52414",
  storageBucket: "web-inspector-pro-52414.firebasestorage.app",
  messagingSenderId: "501258349129",
  appId: "1:501258349129:web:72c29aa2c06a42a6012d98",
  measurementId: "G-8FQ5JP9L85"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();
const functions = firebase.functions();

db.settings({ experimentalForceLongPolling: true });

window.WIP = window.WIP || {};
window.WIP.auth = auth;
window.WIP.db = db;
window.WIP.rtdb = rtdb;
window.WIP.functions = functions;