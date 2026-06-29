import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useRankingConfig() {
  const configQuery = useQuery({
    queryKey: ['ranking-config'],
    queryFn: async () => {
      const items = await base44.entities.RankingConfig.filter({ chave: 'modelo_ativo' });
      return items[0] || null;
    },
    initialData: null,
    staleTime: 1000 * 60 * 5,
  });

  const composicoesQuery = useQuery({
    queryKey: ['ranking-composicoes'],
    queryFn: () => base44.entities.RankingComposicao.filter({ status: 'ativo' }),
    initialData: [],
    staleTime: 1000 * 60 * 5,
  });

  const modeloAtivo = configQuery.data?.valor || 'padrao';

  return {
    modeloAtivo,
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
      if (items.length > 0) {
        return base44.entities.RankingConfig.update(items[0].id, { valor: modelo });
      } else {
        return base44.entities.RankingConfig.create({ chave: 'modelo_ativo', valor: modelo, descricao: 'Modelo de contabilização ativo para ranking e dashboard' });
      }
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