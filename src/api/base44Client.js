import { db, auth, storage } from "@/firebase";

export const firebaseClient = {
  db,
  auth,
  storage
};

// helpers futuros (mantém compatibilidade de código antigo)
export const getDB = () => db;
export const getAuth = () => auth;
export const getStorage = () => storage;