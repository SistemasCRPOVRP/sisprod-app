import { useQuery } from '@tanstack/react-query';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { getCurrentPeriodo } from '@/lib/utils';

/*
 * usePeriodoInicial — descobre o trimestre mais recente que tem lançamentos,
 * fazendo uma busca LEVE (apenas 1 registro, o mais recente por data).
 * Usado para abrir Histórico/Relatórios já no último período com dados,
 * em vez do trimestre atual (que fica vazio no início de cada trimestre).
 *
 * Custo de cota: 1 leitura por sessão (cacheado por 10 min).
 */
export function usePeriodoInicial() {
  const { data: periodoComDados } = useQuery({
    queryKey: ['periodo-inicial'],
    queryFn: async () => {
      try {
        // Busca o lançamento mais recente (por data) para saber o período ativo
        const qRef = query(
          collection(db, 'Production'),
          orderBy('data', 'desc'),
          limit(1)
        );
        const snap = await getDocs(qRef);
        if (!snap.empty) {
          const doc = snap.docs[0].data();
          if (doc.periodo) return doc.periodo;
        }
      } catch (err) {
        // Se a busca com orderBy falhar (ex.: falta índice), usa fallback
        console.warn('usePeriodoInicial fallback:', err?.message);
      }
      return getCurrentPeriodo();
    },
    initialData: getCurrentPeriodo(),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  return periodoComDados || getCurrentPeriodo();
}
