import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useRankingConfig() {
  const configQuery = useQuery({
    queryKey: ['ranking-config'],
    queryFn: async () => {
      const items = await base44.entities.RankingConfig.filter({ chave: 'modelo_ativo' });
      if (!items || items.length === 0) return null;
      // Pode haver registros duplicados — pega sempre o mais recente (por data).
      const ordenados = [...items].sort(
        (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
      );
      return ordenados[0];
    },
    initialData: null,
    // Marca o initialData como já desatualizado (timestamp 0) em vez de
    // "agora" — sem isso, o valor null "contava" como dado fresco por 5min e
    // o app inteiro abria sempre como se o modelo fosse "padrão" (OPMs
    // individuais), mesmo com "Somente grupos" configurado e salvo.
    initialDataUpdatedAt: 0,
    staleTime: 1000 * 60 * 5,
  });

  const composicoesQuery = useQuery({
    queryKey: ['ranking-composicoes'],
    queryFn: () => base44.entities.RankingComposicao.filter({ status: 'ativo' }),
    initialData: [],
    initialDataUpdatedAt: 0,
    staleTime: 1000 * 60 * 5,
  });

  const modeloAtivo = configQuery.data?.valor || 'padrao';

  return {
    modeloAtivo,
    // "pronto" só fica true depois da busca REAL no Firestore (dataUpdatedAt
    // > 0). "modeloAtivo" sozinho não serve como sinal de carregado, pois
    // ele já nasce com o valor de fallback "padrao" (truthy) antes mesmo da
    // 1ª busca terminar — o que fazia telas como o Dashboard travarem a
    // visualização inicial usando esse valor de fallback, ignorando o
    // "personalizado" real assim que ele chegava.
    pronto: configQuery.dataUpdatedAt > 0,
    configRecord: configQuery.data,
    composicoes: composicoesQuery.data,
    isLoading: configQuery.isLoading || composicoesQuery.isLoading,
  };
}

export function useRankingConfigMutations() {
  const queryClient = useQueryClient();

  const setModelo = useMutation({
    mutationFn: async (modelo) => {
      const items = await base44.entities.RankingConfig.filter({ chave: 'modelo_ativo' });
      if (items && items.length > 0) {
        // Ordena por data — o mais recente é o "oficial" que será mantido e atualizado.
        const ordenados = [...items].sort(
          (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
        );
        const principal = ordenados[0];
        // Remove TODOS os duplicados extras (deixa só o principal), evitando inconsistência.
        for (let i = 1; i < ordenados.length; i++) {
          try { await base44.entities.RankingConfig.delete(ordenados[i].id); } catch {}
        }
        return base44.entities.RankingConfig.update(principal.id, { valor: modelo });
      }
      return base44.entities.RankingConfig.create({
        chave: 'modelo_ativo',
        valor: modelo,
        descricao: 'Modelo de contabilização ativo para ranking e dashboard',
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ranking-config'] }),
  });

  const criarComposicao = useMutation({
    mutationFn: (data) => base44.entities.RankingComposicao.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] }),
  });

  const atualizarComposicao = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RankingComposicao.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] }),
    onError: (err) => {
      if (err?.message?.includes('not found')) queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] });
    },
  });

  const excluirComposicao = useMutation({
    mutationFn: (id) => base44.entities.RankingComposicao.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] }),
    onError: (err) => {
      if (err?.message?.includes('not found')) queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] });
    },
  });

  return { setModelo, criarComposicao, atualizarComposicao, excluirComposicao };
}