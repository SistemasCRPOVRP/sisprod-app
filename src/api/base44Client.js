import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, get, set, update } from 'firebase/database';

// Configuração obtida diretamente das variáveis de ambiente que cadastramos na Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializa o Firebase protegendo contra o erro de aplicativo duplicado (Evita a tela branca)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

// Motor adaptador do antigo Base44 focado em ler o Firebase por texto puro
export const base44 = {
  auth: {
    login: async ({ username, password }) => {
      const userRef = ref(db, `usuarios/${username.trim().toLowerCase()}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        throw new Error('Usuário não encontrado no sistema.');
      }
      
      const userData = snapshot.val();
      if (userData.senha !== password) {
        throw new Error('Senha incorreta.');
      }
      
      return { user: { id: username, ...userData } };
    }
  },
  entities: (entityName) => ({
    get: async (id) => {
      const nodeRef = ref(db, `${entityName}/${id}`);
      const snapshot = await get(nodeRef);
      return snapshot.exists() ? snapshot.val() : null;
    },
    create: async (data) => {
      const id = data.id || Math.random().toString(36).substring(2, 9);
      const nodeRef = ref(db, `${entityName}/${id}`);
      await set(nodeRef, data);
      return { id, ...data };
    },
    update: async (id, data) => {
      const nodeRef = ref(db, `${entityName}/${id}`);
      await update(nodeRef, data);
      return { id, ...data };
    }
  })
};

export default base44;
