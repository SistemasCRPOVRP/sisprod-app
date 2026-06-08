import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Shield, Users, User, MapPin, Info } from 'lucide-react';
import { toast } from 'sonner';
import GruposTab from '@/components/grupos/GruposTab';
import { useRankingConfig, useRankingConfigMutations } from '@/hooks/useRankingConfig';
import { useGruposConcorrentes } from '@/hooks/useGruposConcorrentes';

export default function GruposConcorrentes() {
  const { appUser } = useOutletContext() || {};
  const { modeloAtivo } = useRankingConfig();
  const { setModelo } = useRankingConfigMutations();
  const { grupos: todasComposicoes } = useGruposConcorrentes(null);
  const [activeTab, setActiveTab] = useState('companhia');

  const countByTipo = (tipo) => todasComposicoes.filter(g => g.tipo_nivel === tipo && g.status !== 'inativo').length;

  const handleToggleModelo = async () => {
    const novo = modeloAtivo === 'padrao' ? 'personalizado' : 'padrao';
    await setModelo.mutateAsync(novo);
    toast.success(novo === 'padrao' ? 'Modelo padrão ativado' : 'Exibição por grupos ativada');
  };

  if (appUser && appUser.perfil !== 'administrador') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="text-xl font-bold text-muted-foreground">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground max-w-xs">Esta área é exclusiva para administradores do sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Grupos Concorrentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie grupos de OPMs que concorrem juntos nos rankings e dashboards operacionais
          </p>
        </div>
      </div>

      {/* Modo de exibição */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">Modo de Exibição do Ranking</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              <strong>OPMs individuais:</strong> cada unidade aparece separadamente no ranking.<br />
              <strong>Somente grupos concorrentes:</strong> apenas os grupos configurados abaixo aparecem — as pontuações das unidades integrantes são somadas automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Modo ativo</p>
              <p className={`text-sm font-bold ${modeloAtivo === 'personalizado' ? 'text-primary' : 'text-foreground'}`}>
                {modeloAtivo === 'personalizado' ? 'Somente grupos' : 'OPMs individuais'}
              </p>
            </div>
            <Switch checked={modeloAtivo === 'personalizado'} onCheckedChange={handleToggleModelo} disabled={setModelo.isPending} />
          </div>
        </div>

        {modeloAtivo === 'personalizado' && todasComposicoes.filter(g => g.status !== 'inativo').length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">Nenhum grupo ativo criado. Crie grupos abaixo para que o modo de grupos funcione corretamente.</p>
          </div>
        )}
      </div>

      {/* Resumo de grupos ativos */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { tipo: 'companhia', label: 'CIAs', iconEl: <Users className="w-6 h-6 flex-shrink-0" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { tipo: 'pelotao', label: 'Pelotões', iconEl: <User className="w-6 h-6 flex-shrink-0" />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
          { tipo: 'gpm', label: 'GPMs', iconEl: <MapPin className="w-6 h-6 flex-shrink-0" />, color: 'text-green-600 bg-green-50 border-green-200' },
        ].map(({ tipo, label, iconEl, color }) => (
          <div key={tipo} className={`rounded-xl border p-4 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-shadow ${color}`}
            onClick={() => setActiveTab(tipo === 'companhia' ? 'companhia' : tipo)}>
            {iconEl}
            <div>
              <p className="text-xs font-medium opacity-70">Grupos de {label}</p>
              <p className="text-2xl font-bold">{countByTipo(tipo)}</p>
              <p className="text-[10px] opacity-60">ativos</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="companhia" className="gap-1.5">
            <Users className="w-4 h-4" /> CIAs
            {countByTipo('companhia') > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{countByTipo('companhia')}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pelotao" className="gap-1.5">
            <User className="w-4 h-4" /> Pelotões
            {countByTipo('pelotao') > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{countByTipo('pelotao')}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="gpm" className="gap-1.5">
            <MapPin className="w-4 h-4" /> GPMs
            {countByTipo('gpm') > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{countByTipo('gpm')}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companhia" className="mt-4">
          <GruposTab tipoNivel="companhia" tipoLabel="CIA" />
        </TabsContent>
        <TabsContent value="pelotao" className="mt-4">
          <GruposTab tipoNivel="pelotao" tipoLabel="Pelotão" />
        </TabsContent>
        <TabsContent value="gpm" className="mt-4">
          <GruposTab tipoNivel="gpm" tipoLabel="GPM" />
        </TabsContent>
      </Tabs>

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2.5">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>
          Grupos inativos não participam dos rankings. Ao ativar "Somente grupos concorrentes", as OPMs pertencentes a um grupo não aparecem individualmente — prevenindo duplicidade de pontuação. Todas as alterações ficam registradas no log de auditoria.
        </p>
      </div>
    </div>
  );
}