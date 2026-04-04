import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  increment,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  documentId,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";

const _cfg = {
  apiKey: "AIzaSyACACrfmp0EpnsuVClv57VmDz5uMQ39qdM",
  authDomain: "digimun-49.firebaseapp.com",
  databaseURL: "https://digimun-49-default-rtdb.firebaseio.com",
  projectId: "digimun-49",
  storageBucket: "digimun-49.firebasestorage.app",
  messagingSenderId: "624588089371",
  appId: "1:624588089371:web:3d932c99fef512213c70be"
};

const existingApps = getApps();
const app = existingApps.length > 0 ? existingApps[0] : initializeApp(_cfg);

if (window.location.hostname === 'digimun.pro' || window.location.hostname === 'www.digimun.pro') {
  const APP_CHECK_KEY = '6LcI9oUsAAAAAJDtdPV9nmqIZ0fqnsu_0z3AW_c2';
  const AC_INIT_KEY = '_acInit';

  if (!window[AC_INIT_KEY]) {
    window[AC_INIT_KEY] = true;
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(APP_CHECK_KEY),
        isTokenAutoRefreshEnabled: false
      });
    } catch (e) { /* App Check optional */ }
  }
}

const auth = getAuth(app);
const db = getFirestore(app);

window._auth = auth;
window._db = db;
window._app = app;
window._ready = true;

export {
  app, auth, db,
  initializeApp, getApps, getApp,
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup,
  sendEmailVerification, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence,
  applyActionCode, verifyPasswordResetCode, confirmPasswordReset, signInAnonymously,
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, getDocs, query, where, orderBy, limit, startAfter,
  onSnapshot, increment, serverTimestamp, arrayUnion, arrayRemove, documentId,
  getCountFromServer
};
