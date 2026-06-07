import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDkEnXTwCZZ4c4N3Wm9cU6zDF_2XwlZG6M",
  authDomain: "sisprod-banco-de-dados.firebaseapp.com",
  projectId: "sisprod-banco-de-dados",
  storageBucket: "sisprod-banco-de-dados.firebasestorage.app",
  messagingSenderId: "396724279966",
  appId: "1:396724279966:web:37e0dfc9b6ea7259bf398f"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;