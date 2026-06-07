import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { db } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  addDoc,
} from 'firebase/firestore';

const AppAuthContext = createContext();

const SESSION_KEY = 'sisprod_session';
const SESSION_VERSION = 3;

// ── Helpers ────────────────────────────────────────────────────────────────

const saveSession = (user) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, _v: SESSION_VERSION }));
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

// LOG agora em Firestore
const logAudit = async (acao, detalhe, usuario = 'sistema') => {
  try {
    await addDoc(collection(db, 'AuditLog'), {
      usuario,
      acao,
      tabela: 'Auth',
      detalhe,
      created_at: new Date()
    });
  } catch {}
};

// ── Provider ───────────────────────────────────────────────────────────────

export const AppAuthProvider = ({ children }) => {
  const [appUser, setAppUser] = useState(null);
  const [isAppAuthenticated, setIsAppAuthenticated] = useState(false);
  const [isLoadingAppAuth, setIsLoadingAppAuth] = useState(true);
  const refreshTimerRef = useRef(null);

  // ── Restore session ─────────────────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) { setIsLoadingAppAuth(false); return; }

      try {
        const parsed = JSON.parse(saved);

        if (parsed._v !== SESSION_VERSION) {
          clearSession();
          setIsLoadingAppAuth(false);
          return;
        }

        const q = query(
          collection(db, "AppUser"),
          where("id_funcional", "==", parsed.id_funcional),
          where("status", "==", "ativo")
        );

        const snap = await getDocs(q);

        if (snap.empty) {
          clearSession();
          setIsLoadingAppAuth(false);
          return;
        }

        const fresh = { id: snap.docs[0].id, ...snap.docs[0].data() };

        saveSession(fresh);
        setAppUser(fresh);
        setIsAppAuthenticated(true);
        scheduleRefresh(fresh);

      } catch {
        clearSession();
      }

      setIsLoadingAppAuth(false);
    };

    restore();
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  // ── Refresh session ─────────────────────────────────────────────────────
  const scheduleRefresh = (user) => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);

    refreshTimerRef.current = setInterval(async () => {
      try {
        const q = query(
          collection(db, "AppUser"),
          where("id_funcional", "==", user.id_funcional),
          where("status", "==", "ativo")
        );

        const snap = await getDocs(q);

        if (snap.empty) return logout();

        const fresh = { id: snap.docs[0].id, ...snap.docs[0].data() };
        saveSession(fresh);
        setAppUser(fresh);

      } catch {}
    }, 5 * 60 * 1000);
  };

  // ── LOGIN ────────────────────────────────────────────────────────────────
  const login = async (id_funcional, senha) => {
    const q = query(
      collection(db, "AppUser"),
      where("id_funcional", "==", id_funcional.trim())
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      await logAudit('login_falhou', `Usuário inexistente: ${id_funcional}`);
      throw new Error('Usuário não encontrado.');
    }

    const user = { id: snap.docs[0].id, ...snap.docs[0].data() };

    if (user.status !== 'ativo') {
      await logAudit('login_bloqueado', id_funcional);
      throw new Error('Usuário bloqueado.');
    }

    if (user.senha_hash !== senha) {
      await logAudit('senha_incorreta', id_funcional);
      throw new Error('Senha incorreta.');
    }

    saveSession(user);
    setAppUser(user);
    setIsAppAuthenticated(true);
    scheduleRefresh(user);

    await logAudit('login_sucesso', `Login: ${user.nome_completo}`, user.id_funcional);

    return user;
  };

  // ── LOGOUT ───────────────────────────────────────────────────────────────
  const logout = () => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    clearSession();
    setAppUser(null);
    setIsAppAuthenticated(false);
    window.location.href = '/acesso';
  };

  // ── UPDATE PASSWORD ──────────────────────────────────────────────────────
  const changeAdminPassword = async (idFuncional, senhaAtual, novaSenha) => {
    const q = query(
      collection(db, "AppUser"),
      where("id_funcional", "==", idFuncional.trim())
    );

    const snap = await getDocs(q);

    if (snap.empty) throw new Error('Usuário não encontrado.');

    const ref = doc(db, "AppUser", snap.docs[0].id);
    const user = snap.docs[0].data();

    if (user.senha_hash !== senhaAtual) {
      throw new Error('Senha atual incorreta.');
    }

    await updateDoc(ref, { senha_hash: novaSenha });

    await logAudit('senha_alterada', idFuncional);
  };

  // ── PERMISSÕES (mantidas iguais) ────────────────────────────────────────
  const canViewBpm = (bpm) => {
    if (!appUser) return false;
    const p = appUser.perfil;
    if (['administrador','comandante_crpm','p1','p2','p3','p4'].includes(p)) return true;
    return appUser.bpm === bpm;
  };

  const canViewOrg = (org_id) => {
    if (!appUser) return false;
    const p = appUser.perfil;
    if (['administrador','comandante_crpm','p1','p2','p3','p4'].includes(p)) return true;
    return org_id === (appUser.organization_id || '');
  };

  const isAdmin = () => appUser?.perfil === 'administrador';
  const isCrpm = () => ['administrador','comandante_crpm','p1','p2','p3','p4'].includes(appUser?.perfil);

  return (
    <AppAuthContext.Provider value={{
      appUser,
      isAppAuthenticated,
      isLoadingAppAuth,
      login,
      logout,
      changeAdminPassword,
      canViewBpm,
      canViewOrg,
      isAdmin,
      isCrpm,
    }}>
      {children}
    </AppAuthContext.Provider>
  );
};

export const useAppAuth = () => {
  const ctx = useContext(AppAuthContext);
  if (!ctx) throw new Error('useAppAuth must be used within AppAuthProvider');
  return ctx;
};
