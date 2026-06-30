import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useGruposConcorrentes(tipoNivel) {
  // Sem listener em tempo real (economiza cota). Os grupos mudam pouco e
  // são atualizados via invalidateQueries nas mutations (criar/editar/excluir).
  const query = useQuery({
    queryKey: ['grupos-concorrentes', tipoNivel],
    queryFn: () => tipoNivel
      ? base44.entities.RankingComposicao.filter({ tipo_nivel: tipoNivel })
      : base44.entities.RankingComposicao.list('-created_date'),
    initialData: [],
    staleTime: 1000 * 60 * 5,
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