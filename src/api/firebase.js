// src/api/firebase.js
// Reexporta a MESMA instância do Firebase já inicializada em base44Client.js.
// Isso evita criar uma segunda conexão Firebase (que duplicaria as leituras
// e consumia a cota diária do Firestore mais rápido).

export { db } from '@/api/base44Client';