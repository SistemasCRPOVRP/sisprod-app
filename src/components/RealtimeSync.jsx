import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  onSnapshot,
  collection,
} from 'firebase/firestore';

import { db } from '@/api/base44Client';
import { useAppAuth } from '@/lib/AppAuthContext';

export default function RealtimeSync() {
  const queryClient = useQueryClient();
  const { appUser } = useAppAuth();

  const invalidateProductions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['all-productions'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['productions'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['hist-lancamento'], exact: false });
  }, [queryClient]);

  useEffect(() => {
    const unsubscribers = [];

    // ─────────────────────────────────────────────
    // PRODUCTION
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'Production'), (snapshot) => {
        invalidateProductions();

        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();

          if (change.type === 'added' && data?.created_by !== appUser?.email) {
            toast.info('📋 Novo lançamento registrado', {
              description: `${data?.indicator_name || 'Indicador'} — ${data?.organization_name || ''}`,
              duration: 3500,
            });
          }
        });
      })
    );

    // ─────────────────────────────────────────────
    // INDICATOR
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'Indicator'), () => {
        queryClient.invalidateQueries({ queryKey: ['indicators'] });
      })
    );

    // ─────────────────────────────────────────────
    // ORGANIZATION
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'Organization'), () => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] });
      })
    );

    // ─────────────────────────────────────────────
    // APP USER
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'AppUser'), () => {
        queryClient.invalidateQueries({ queryKey: ['app-users'] });
      })
    );

    // ─────────────────────────────────────────────
    // ACCESS REQUEST
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'AccessRequest'), (snapshot) => {
        queryClient.invalidateQueries({ queryKey: ['access-requests'] });

        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();

          if (change.type === 'modified' && data?.status === 'aprovado') {
            toast.success('✅ Solicitação de acesso aprovada', { duration: 4000 });
          }
        });
      })
    );

    // ─────────────────────────────────────────────
    // EDIT REQUEST
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'EditRequest'), (snapshot) => {
        queryClient.invalidateQueries({ queryKey: ['edit-requests'] });

        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();

          if (change.type === 'modified' && data?.status === 'aprovado') {
            toast.success('✅ Solicitação de edição aprovada! Você já pode editar o registro.', {
              duration: 5000,
            });
          }
        });
      })
    );

    // ─────────────────────────────────────────────
    // RANKING COMPOSIÇÃO
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'RankingComposicao'), () => {
        queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] });
        queryClient.invalidateQueries({ queryKey: ['composicoes'] });
      })
    );

    // ─────────────────────────────────────────────
    // RANKING CONFIG
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'RankingConfig'), () => {
        queryClient.invalidateQueries({ queryKey: ['ranking-config'] });
      })
    );

    // ─────────────────────────────────────────────
    // SYSTEM CONFIG
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'SystemConfig'), () => {
        queryClient.invalidateQueries({ queryKey: ['system-config'] });
      })
    );

    // ─────────────────────────────────────────────
    // AUDIT LOG
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'AuditLog'), () => {
        queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      })
    );

    // ─────────────────────────────────────────────
    // AVISO
    // ─────────────────────────────────────────────
    unsubscribers.push(
      onSnapshot(collection(db, 'Aviso'), () => {
        queryClient.invalidateQueries({ queryKey: ['avisos'], exact: false });
      })
    );

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [queryClient, invalidateProductions, appUser?.email]);

  // ── online refresh ──
  useEffect(() => {
    const handleOnline = () => queryClient.invalidateQueries();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  // ── visibility refresh ──
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