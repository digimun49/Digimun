// /digimunx/firebase.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyACACrfmp0EpnsuVClv57VmDz5uMQ39qdM",
  authDomain: "digimun-49.firebaseapp.com",
  databaseURL: "https://digimun-49-default-rtdb.firebaseio.com",
  projectId: "digimun-49",
  storageBucket: "digimun-49.firebasestorage.app",
  messagingSenderId: "624588089371",
  appId: "1:624588089371:web:3d932c99fef512213c70be"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
try { setPersistence(auth, browserLocalPersistence); } catch(e) {}
const db = getFirestore(app);

export { app, auth, db };
