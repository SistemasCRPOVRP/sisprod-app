import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAppAuth } from '@/lib/AppAuthContext';

/*
 * RealtimeSync — versão otimizada para economizar cota do Firestore.
 *
 * ANTES: abria onSnapshot em 11 coleções (Production, AuditLog, etc.),
 * cada um relendo a coleção inteira a cada mudança, mais invalidação
 * global de TODAS as queries ao focar a aba. Isso esgotava a cota
 * diária (50.000 leituras) em minutos e causava o "carrega e some".
 *
 * AGORA: escuta apenas eventos administrativos LEVES e direcionados ao
 * próprio usuário (aprovação de acesso/edição), sem reler dados pesados.
 * Os dados de produção/ranking/dashboard são atualizados ao abrir a aba
 * ou pelo botão "Atualizar", não em tempo real contínuo.
 */
export default function RealtimeSync() {
  const queryClient = useQueryClient();
  const { appUser } = useAppAuth();

  useEffect(() => {
    if (!appUser?.id_funcional) return;
    const unsubscribers = [];

    // EDIT REQUEST — só notifica o solicitante quando sua liberação é aprovada
    try {
      const qEdit = query(
        collection(db, 'EditRequest'),
        where('solicitante_email', '==', appUser.email || appUser.id_funcional)
      );
      unsubscribers.push(
        onSnapshot(qEdit, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            if (change.type === 'modified' && data?.status === 'aprovado') {
              queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
              toast.success('✅ Sua solicitação de edição foi aprovada! Você já pode editar o registro.', {
                duration: 5000,
              });
            }
          });
        })
      );
    } catch {}

    // ACCESS REQUEST — só para administradores, para saber de novos pedidos
    if (appUser?.perfil === 'administrador') {
      try {
        unsubscribers.push(
          onSnapshot(
            query(collection(db, 'AccessRequest'), where('status', '==', 'pendente')),
            (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  queryClient.invalidateQueries({ queryKey: ['access-requests'] });
                  toast.info('📋 Nova solicitação de acesso recebida', { duration: 4000 });
                }
              });
            }
          )
        );
      } catch {}
    }

    return () => unsubscribers.forEach((unsub) => { try { unsub(); } catch {} });
  }, [queryClient, appUser?.id_funcional, appUser?.email, appUser?.perfil]);

  return null;
}
