import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 0,              // dados sempre considerados "velhos" → refetch imediato
			gcTime: 1000 * 60 * 5,    // mantém cache 5 min para evitar flicker
			refetchOnWindowFocus: true, // revalida ao voltar para a aba/app
			refetchOnReconnect: true,  // revalida ao reconectar internet
			retry: 2,
		},
	},
});
