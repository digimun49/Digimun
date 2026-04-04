import { app, auth, db, setPersistence, browserLocalPersistence } from "../platform.js";

try { setPersistence(auth, browserLocalPersistence); } catch(e) {}

export { app, auth, db };
