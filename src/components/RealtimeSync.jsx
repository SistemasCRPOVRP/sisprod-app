/**
 * RealtimeSync — sincronização em tempo real para todos os usuários logados.
 * Montado uma única vez no AppLayout.
 * Usa subscriptions do base44 SDK para invalidar queries automaticamente
 * sempre que qualquer entidade for criada, atualizada ou deletada.
 */
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useAppAuth } from '@/lib/AppAuthContext';

export default function RealtimeSync() {
  const queryClient = useQueryClient();
  const { appUser } = useAppAuth();

  // Invalida todas as queries relacionadas a produção de uma vez
  const invalidateProductions = useCallback(() => {
    // Invalida TODAS as queries que começam com estas chaves (incluindo subchaves como periodo)
    queryClient.invalidateQueries({ queryKey: ['all-productions'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['productions'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['hist-lancamento'], exact: false });
  }, [queryClient]);

  useEffect(() => {
    const subs = [];

    // ── Production ──────────────────────────────────────────────
    subs.push(base44.entities.Production.subscribe((event) => {
      invalidateProductions();
      // Notifica apenas se o evento veio de outro usuário
      if (event.type === 'create' && event.data?.created_by !== appUser?.email) {
        toast.info('📋 Novo lançamento registrado', {
          description: `${event.data?.indicator_name || 'Indicador'} — ${event.data?.organization_name || ''}`,
          duration: 3500,
        });
      }
      if (event.type === 'delete') {
        invalidateProductions();
      }
    }));

    // ── Indicator ────────────────────────────────────────────────
    subs.push(base44.entities.Indicator.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
    }));

    // ── Organization ─────────────────────────────────────────────
    subs.push(base44.entities.Organization.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }));

    // ── AppUser ──────────────────────────────────────────────────
    subs.push(base44.entities.AppUser.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
    }));

    // ── AccessRequest ────────────────────────────────────────────
    subs.push(base44.entities.AccessRequest.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      if (event.type === 'update' && event.data?.status === 'aprovado') {
        toast.success('✅ Solicitação de acesso aprovada', { duration: 4000 });
      }
    }));

    // ── EditRequest ──────────────────────────────────────────────
    subs.push(base44.entities.EditRequest.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
      if (event.type === 'update' && event.data?.status === 'aprovado') {
        toast.success('✅ Solicitação de edição aprovada! Você já pode editar o registro.', { duration: 5000 });
      }
    }));

    // ── RankingComposicao ────────────────────────────────────────
    subs.push(base44.entities.RankingComposicao.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] });
      queryClient.invalidateQueries({ queryKey: ['composicoes'] });
    }));

    // ── RankingConfig ────────────────────────────────────────────
    subs.push(base44.entities.RankingConfig.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['ranking-config'] });
    }));

    // ── SystemConfig ─────────────────────────────────────────────
    subs.push(base44.entities.SystemConfig.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    }));

    // ── AuditLog ─────────────────────────────────────────────────
    subs.push(base44.entities.AuditLog.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    }));

    // ── Aviso ────────────────────────────────────────────────────
    subs.push(base44.entities.Aviso.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['avisos'], exact: false });
    }));

    return () => subs.forEach(unsub => unsub());
  }, [queryClient, invalidateProductions, appUser?.email]);

  // Revalida tudo ao recuperar conexão com a internet
  useEffect(() => {
    const handleOnline = () => {
      queryClient.invalidateQueries();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  // Revalida tudo ao voltar para o app (visibilidade da página)
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries();
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [queryClient]);

  return null;
}