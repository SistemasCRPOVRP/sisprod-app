import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 30,   // dados "frescos" por 30 min — evita refetch a cada navegação
			gcTime: 1000 * 60 * 60,      // mantém cache 60 min
			refetchOnWindowFocus: false, // NÃO rebusca tudo ao voltar pra aba (economiza cota Firestore)
			refetchOnReconnect: false,   // NÃO rebusca tudo ao reconectar
			retry: 1,
		},
	},
});
