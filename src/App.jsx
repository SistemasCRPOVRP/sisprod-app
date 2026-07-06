import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AppAuthProvider, useAppAuth } from '@/lib/AppAuthContext';
import Acesso from '@/pages/Acesso';

import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Dashboard from '@/pages/Dashboard';
import Lancamento from '@/pages/Lancamento';
import Ranking from '@/pages/Ranking';
import Historico from '@/pages/Historico';
import Indicadores from '@/pages/Indicadores';
import Unidades from '@/pages/Unidades';
import Admin from '@/pages/Admin';
import Mapa from '@/pages/Mapa';
import Relatorios from '@/pages/Relatorios';
import Creator from '@/pages/Creator';
import GruposConcorrentes from '@/pages/GruposConcorrentes';
import AtualizacaoSistema from '@/pages/AtualizacaoSistema';

const AppRoutes = () => {
  const { isAppAuthenticated, isLoadingAppAuth } = useAppAuth();

  if (isLoadingAppAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-4">Carregando SISPROD BM...</p>
        </div>
      </div>
    );
  }

  if (!isAppAuthenticated) {
    return (
      <Routes>
        <Route path="/acesso" element={<Acesso />} />
        <Route path="*" element={<Navigate to="/acesso" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lancamento" element={<Lancamento />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/indicadores" element={<Indicadores />} />
        <Route path="/unidades" element={<Unidades />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/grupos-concorrentes" element={<GruposConcorrentes />} />
        <Route path="/atualizacao" element={<AtualizacaoSistema />} />
        <Route path="/creator" element={<Creator />} />
        <Route path="/acesso" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AppAuthProvider>
          <AppRoutes />
        </AppAuthProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App