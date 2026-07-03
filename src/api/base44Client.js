// src/api/base44Client.js

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
} from 'firebase/firestore';

// =========================
// FIREBASE INIT
// =========================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Cache persistente local (IndexedDB) com suporte a múltiplas abas.
// Reduz leituras cobradas: dados já vistos são servidos do cache do
// dispositivo em vez de reler o Firestore, economizando a cota diária.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (err) {
  console.warn('Cache persistente do Firestore indisponível, usando padrão:', err?.message);
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

// =========================
// UTIL: ORDER PARSER
// =========================

function parseOrder(sort) {
  if (!sort) return null;
  const isDesc = sort.startsWith('-');
  const field = isDesc ? sort.slice(1) : sort;
  return orderBy(field, isDesc ? 'desc' : 'asc');
}

// =========================
// UTIL: COLLECTION NAME
// =========================

const getCollection = (entity) => collection(db, entity);

// =========================
// CLOUDINARY UPLOAD
// =========================

export async function uploadFile(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const isPDF = file.type === 'application/pdf';
  const endpoint = isPDF
    ? `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`
    : `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'sisprod');

  const response = await fetch(endpoint, { method: 'POST', body: formData });

  if (!response.ok) throw new Error('Erro ao fazer upload do arquivo');

  const data = await response.json();
  return { file_url: data.secure_url };
}

// =========================
// UTIL: GET DOWNLOAD URL
// =========================

export function getDownloadUrl(url) {
  if (!url) return url;
  // PDFs salvos como /image/upload/ precisam ser convertidos para /raw/upload/
  if (url.includes('/image/upload/') && url.endsWith('.pdf')) {
    return url.replace('/image/upload/', '/raw/upload/fl_attachment/');
  }
  return url;
}

// =========================
// BASE ENTITY FACTORY
// =========================

function createEntity(entityName) {
  const col = getCollection(entityName);

  return {
    async create(data) {
      const ref = await addDoc(col, {
        ...data,
        created_date: new Date().toISOString(),
      });
      return { id: ref.id, ...data };
    },

    async update(id, data) {
      const ref = doc(db, entityName, id);
      await updateDoc(ref, data);
      return { id, ...data };
    },

    async delete(id) {
      const ref = doc(db, entityName, id);
      await deleteDoc(ref);
      return true;
    },

    async get(id) {
      const ref = doc(db, entityName, id);
      const snap = await getDoc(ref);
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    // LIST SIMPLES — limite padrão de 1000 (uso geral do app).
    // Faz UMA única leitura limitada, economizando cota do Firestore.
    async list(sort, limitValue = 1000) {
      const constraints = [];
      if (sort) constraints.push(parseOrder(sort));
      if (limitValue) constraints.push(limit(limitValue));
      const q = query(col, ...constraints.filter(Boolean));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // LIST ALL — pagina sem limite, busca TODOS os registros.
    // Usar SOMENTE no backup/exportação, nunca em telas comuns.
    async listAll(sort) {
      const BATCH = 1000;
      const allDocs = [];
      let lastDoc = null;

      while (true) {
        const constraints = [limit(BATCH)];
        if (lastDoc) constraints.push(startAfter(lastDoc));
        const q = query(col, ...constraints);
        const snap = await getDocs(q);

        snap.docs.forEach(d => allDocs.push({ id: d.id, ...d.data() }));
        lastDoc = snap.docs[snap.docs.length - 1];

        if (snap.docs.length < BATCH) break;
      }

      // Ordena em memória após buscar tudo
      if (sort) {
        const isDesc = sort.startsWith('-');
        const field = isDesc ? sort.slice(1) : sort;
        allDocs.sort((a, b) => {
          const va = String(a[field] ?? '');
          const vb = String(b[field] ?? '');
          return isDesc ? vb.localeCompare(va) : va.localeCompare(vb);
        });
      }

      return allDocs;
    },

    async filter(filters = {}, sort, limitValue = 1000) {
      const constraints = [];
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          constraints.push(where(key, '==', value));
        }
      });
      if (sort) constraints.push(parseOrder(sort));
      if (limitValue) constraints.push(limit(limitValue));
      const q = query(col, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    subscribe(callback) {
      const q = query(col);
      return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() };
          if (change.type === 'added') callback({ type: 'create', data });
          if (change.type === 'modified') callback({ type: 'update', data });
          if (change.type === 'removed') callback({ type: 'delete', data });
        });
      });
    },
  };
}

// =========================
// ENTITIES (COMPAT BASE44)
// =========================

const entities = {
  AppUser: createEntity('AppUser'),
  AccessRequest: createEntity('AccessRequest'),
  AuditLog: createEntity('AuditLog'),
  Aviso: createEntity('Aviso'),
  EditRequest: createEntity('EditRequest'),
  Indicator: createEntity('Indicator'),
  Organization: createEntity('Organization'),
  Production: createEntity('Production'),
  RankingConfig: createEntity('RankingConfig'),
  RankingComposicao: createEntity('RankingComposicao'),
  SystemConfig: createEntity('SystemConfig'),
  User: createEntity('User'),
};

// =========================
// EXPORT COMPATIBILITY LAYER
// =========================

export const base44 = {
  entities,
};