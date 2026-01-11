// firebase.js

// 🔌 Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔐 Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyACACrfmp0EpnsuVClv57VmDz5uMQ39qdM",
  authDomain: "digimun-49.firebaseapp.com",
  databaseURL: "https://digimun-49-default-rtdb.firebaseio.com",
  projectId: "digimun-49",
  storageBucket: "digimun-49.appspot.com",
  messagingSenderId: "624588089371",
  appId: "1:624588089371:web:3d932c99fef512213c70be"
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 🔑 Setup Auth and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// 📤 Export for use in other JS files
export { auth, db, app };