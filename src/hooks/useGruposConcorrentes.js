import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useGruposConcorrentes(tipoNivel) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = base44.entities.RankingComposicao.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['grupos-concorrentes'] });
      queryClient.invalidateQueries({ queryKey: ['ranking-composicoes'] });
    });
    return unsub;
  }, [queryClient]);

  const query = useQuery({
    queryKey: ['grupos-concorrentes', tipoNivel],
    queryFn: () => tipoNivel
      ? base44.entities.RankingComposicao.filter({ tipo_nivel: tipoNivel })
      : base44.entities.RankingComposicao.list('-created_date', 200),
    initialData: [],
  });

  return { grupos: query.data, isLoading: query.isLoading };
}

export function useGruposMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['grupos-concorrentes'] });

  const criar = useMutation({
    mutationFn: (data) => base44.entities.RankingComposicao.create(data),
    onSuccess: invalidate,
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RankingComposicao.update(id, data),
    onSuccess: invalidate,
    onError: (err) => {
      if (err?.message?.includes('not found')) invalidate();
    },
  });

  const excluir = useMutation({
    mutationFn: (id) => base44.entities.RankingComposicao.delete(id),
    onSuccess: invalidate,
    onError: (err) => {
      if (err?.message?.includes('not found')) invalidate();
    },
  });

  return { criar, atualizar, excluir };
}
