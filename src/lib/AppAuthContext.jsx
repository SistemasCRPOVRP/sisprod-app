import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const AppAuthContext = createContext();

const SESSION_KEY = 'sisprod_session';
const SESSION_VERSION = 3; // incrementar força logout em todos os dispositivos

// ── Helpers ────────────────────────────────────────────────────────────────

const saveSession = (user) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, _v: SESSION_VERSION }));
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

const logAudit = async (acao, detalhe, usuario = 'sistema') => {
  try {
    await base44.entities.AuditLog.create({ usuario, acao, tabela: 'Auth', detalhe });
  } catch {}
};

// ── Provider ───────────────────────────────────────────────────────────────

export const AppAuthProvider = ({ children }) => {
  const [appUser, setAppUser] = useState(null);
  const [isAppAuthenticated, setIsAppAuthenticated] = useState(false);
  const [isLoadingAppAuth, setIsLoadingAppAuth] = useState(true);
  const refreshTimerRef = useRef(null);

  // ── Restaura sessão do localStorage e valida contra o banco ──────────────
  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) { setIsLoadingAppAuth(false); return; }

      try {
        const parsed = JSON.parse(saved);

        // Força logout se versão de sessão mudou
        if (parsed._v !== SESSION_VERSION) {
          clearSession();
          setIsLoadingAppAuth(false);
          return;
        }

        // Admin configurado no banco — valida a cada restore
        if (parsed.perfil === 'administrador' && parsed.id_funcional) {
          const admins = await base44.entities.AppUser.filter(
            { id_funcional: parsed.id_funcional, status: 'ativo' }, '-created_date', 1
          );
          if (!admins || admins.length === 0) {
            clearSession();
            setIsLoadingAppAuth(false);
            return;
          }
          const fresh = admins[0];
          saveSession(fresh);
          setAppUser(fresh);
          setIsAppAuthenticated(true);
          setIsLoadingAppAuth(false);
          scheduleRefresh(fresh);
          return;
        }

        // Usuário normal — valida e atualiza dados do banco
        if (parsed.id_funcional) {
          const users = await base44.entities.AppUser.filter(
            { id_funcional: parsed.id_funcional, status: 'ativo' }, '-created_date', 1
          );
          if (!users || users.length === 0) {
            clearSession();
            setIsLoadingAppAuth(false);
            return;
          }
          const fresh = users[0];
          saveSession(fresh);
          setAppUser(fresh);
          setIsAppAuthenticated(true);
          setIsLoadingAppAuth(false);
          scheduleRefresh(fresh);
          return;
        }
      } catch {
        // Falha de rede: usa sessão em cache (offline-first)
        try {
          const parsed = JSON.parse(saved);
          if (parsed._v === SESSION_VERSION && parsed.id_funcional) {
            setAppUser(parsed);
            setIsAppAuthenticated(true);
          } else {
            clearSession();
          }
        } catch {
          clearSession();
        }
      }
      setIsLoadingAppAuth(false);
    };

    restore();
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, []);

  // Atualiza dados do usuário a cada 5 minutos (mantém sessão sincronizada)
  const scheduleRefresh = (user) => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(async () => {
      if (!user?.id_funcional) return;
      try {
        const users = await base44.entities.AppUser.filter(
          { id_funcional: user.id_funcional, status: 'ativo' }, '-created_date', 1
        );
        if (users?.[0]) {
          saveSession(users[0]);
          setAppUser(users[0]);
        } else {
          // Usuário foi bloqueado/deletado — força logout
          logout();
        }
      } catch {}
    }, 5 * 60 * 1000);
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (id_funcional, senha) => {
    const idTrimmed = id_funcional.trim();

    // Busca o usuário no banco (único ponto de verdade)
    const users = await base44.entities.AppUser.filter(
      { id_funcional: idTrimmed }, '-created_date', 1
    );

    if (!users || users.length === 0) {
      await logAudit('criou', `Tentativa de login com Id. Funcional inexistente: ${idTrimmed}`);
      throw new Error('Usuário não encontrado. Verifique o Id. Funcional ou solicite acesso ao administrador.');
    }

    const user = users[0];

    if (user.status !== 'ativo') {
      await logAudit('criou', `Tentativa de login de usuário inativo: ${idTrimmed}`, user.email || idTrimmed);
      throw new Error('Acesso bloqueado. Entre em contato com o administrador para reativação.');
    }

    if (user.senha_hash !== senha) {
      await logAudit('criou', `Senha incorreta para: ${idTrimmed}`, user.email || idTrimmed);
      throw new Error('Senha incorreta. Verifique a senha ou utilize "Alterar minha senha".');
    }

    saveSession(user);
    setAppUser(user);
    setIsAppAuthenticated(true);
    scheduleRefresh(user);

    await logAudit('criou', `Login realizado com sucesso: ${idTrimmed} — ${user.nome_completo}`, user.email || idTrimmed);

    return user;
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    clearSession();
    setAppUser(null);
    setIsAppAuthenticated(false);
    window.location.href = '/acesso';
  };

  // ── Refresh manual (usado após edição de perfil) ─────────────────────────
  const refreshUser = async () => {
    if (!appUser?.id_funcional) return;
    try {
      const users = await base44.entities.AppUser.filter(
        { id_funcional: appUser.id_funcional, status: 'ativo' }, '-created_date', 1
      );
      if (users?.[0]) {
        saveSession(users[0]);
        setAppUser(users[0]);
      }
    } catch {}
  };

  // ── Troca de senha ────────────────────────────────────────────────────────
  const changeAdminPassword = async (idFuncional, senhaAtual, novaSenha) => {
    const users = await base44.entities.AppUser.filter(
      { id_funcional: idFuncional.trim() }, '-created_date', 1
    );
    if (!users || users.length === 0) throw new Error('Id. Funcional não encontrado.');
    const user = users[0];
    if (user.senha_hash !== senhaAtual) throw new Error('Senha atual incorreta.');
    await base44.entities.AppUser.update(user.id, { senha_hash: novaSenha });
    await logAudit('editou', `Senha alterada para: ${user.id_funcional}`, user.email || user.id_funcional);
  };

  // ── Verificações de acesso ────────────────────────────────────────────────
  const canViewBpm = (bpm) => {
    if (!appUser) return false;
    const p = appUser.perfil;
    if (['administrador', 'comandante_crpm', 'p1', 'p2', 'p3', 'p4'].includes(p)) return true;
    return appUser.bpm === bpm;
  };

  const canViewOrg = (org_id) => {
    if (!appUser) return false;
    const p = appUser.perfil;
    if (['administrador', 'comandante_crpm', 'p1', 'p2', 'p3', 'p4'].includes(p)) return true;
    if (!org_id) return true;
    const [orgBpm, orgCia, orgPel, orgGpm] = org_id.split('|');
    if (p === 'comandante_btl') return appUser.bpm === orgBpm;
    if (p === 'comandante_pel') return appUser.bpm === orgBpm && appUser.companhia === orgCia && appUser.pelotao === orgPel;
    if (p === 'comandante_gpm') return appUser.bpm === orgBpm && appUser.companhia === orgCia && appUser.pelotao === orgPel && appUser.gpm === orgGpm;
    return org_id === (appUser.organization_id || '');
  };

  const isAdmin = () => appUser?.perfil === 'administrador';
  const isCrpm = () => ['administrador', 'comandante_crpm', 'p1', 'p2', 'p3', 'p4'].includes(appUser?.perfil);

  return (
    <AppAuthContext.Provider value={{
      appUser,
      isAppAuthenticated,
      isLoadingAppAuth,
      login,
      logout,
      refreshUser,
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