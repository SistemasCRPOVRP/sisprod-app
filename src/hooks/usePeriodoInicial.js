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
 *
 * Retorna { periodo, pronto }. "pronto" só fica true quando a busca real
 * terminou — sem initialData, para o chamador não confundir o placeholder
 * (trimestre atual) com o resultado de verdade e travar o ajuste automático.
 */
export function usePeriodoInicial() {
  const { data: periodoComDados, isSuccess } = useQuery({
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
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  return { periodo: periodoComDados || getCurrentPeriodo(), pronto: isSuccess };
}
