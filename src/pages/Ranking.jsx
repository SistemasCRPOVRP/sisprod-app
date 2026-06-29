import React, { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentPeriodo, getPeriodoLabel, getAllPeriodos, formatNumber } from '@/lib/utils';
import { useAllProductions, useOrganizations, computeRankings, computeMunicipalRanking, computeComposicaoRanking } from '@/hooks/useProduction';
import { useRankingConfig } from '@/hooks/useRankingConfig';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Trophy, Medal, Award, Star, X, Layers, Printer, RefreshCw } from 'lucide-react';
import ImprimirRankingDialog from '@/components/ranking/ImprimirRankingDialog';

const medals = [
  { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200', label: '1º Lugar' },
  { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200', label: '2º Lugar' },
  { icon: Award, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: '3º Lugar' },
];

// Remove município embutido no name (formato legado: "GPM — município")
function limparNomeUnidade(nome) {
  if (!nome) return '-';
  return nome.replace(/\s*—\s*.+$/, '').trim();
}

// Retorna o município apenas se ele não estiver já contido na cadeia hierárquica (name)
function municipioSeNaoRepetido(name, municipio) {
  if (!municipio) return '';
  if (!name) return municipio;
  const partes = name.split('/').map(s => s.trim().toLowerCase());
  if (partes.includes(municipio.trim().toLowerCase())) return '';
  return municipio;
}

export default function Ranking() {
  const { user } = useOutletContext() || {};
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [periodo, setPeriodo] = useState(getCurrentPeriodo());
  const [useDateRange, setUseDateRange] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [level, setLevel] = useState('municipio');
  const [grupoTipo, setGrupoTipo] = useState('todos');
  const [showImprimirDialog, setShowImprimirDialog] = useState(false);
  const { data: allProductions = [], isLoading, refetch } = useAllProductions();

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['all-productions'] });
    await queryClient.invalidateQueries({ queryKey: ['ranking-config'] });
    await queryClient.invalidateQueries({ queryKey: ['composicoes'] });
    await refetch();
    setRefreshing(false);
  };

  const { data: organizations = [] } = useOrganizations();
  const { modeloAtivo, composicoes = [] } = useRankingConfig();

  const productions = useMemo(() => {
    return (allProductions || []).filter(p => {
      if (useDateRange) {
        if (dataInicio && p.data && p.data < dataInicio) return false;
        if (dataFim && p.data && p.data > dataFim) return false;
      } else {
        if (periodo && p.periodo !== periodo) return false;
      }
      return true;
    });
  }, [allProductions, periodo, useDateRange, dataInicio, dataFim]);

  const isPersonalizado = modeloAtivo === 'personalizado' && composicoes.length > 0;

  // Calcula o ranking conforme o modelo/nível selecionado.
  // computeRankings espera (productions, level) — NÃO passar organizations.
  const ranking = useMemo(() => {
    if (isPersonalizado) {
      return computeComposicaoRanking(productions, composicoes);
    }
    if (level === 'municipio') {
      return computeMunicipalRanking(productions);
    }
    return computeRankings(productions, level);
  }, [isPersonalizado, productions, composicoes, level]);

  // Label do nível atual para exibição
  const levelLabel = { municipio: 'Município', bpm: 'BPM', companhia: 'CIA', pelotao: 'Pelotão', gpm: 'GPM' }[level] || level;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-6rem)]">
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking de Produtividade</h1>
          <p className="text-sm text-muted-foreground mt-1">Classificação das unidades por pontuação</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${isPersonalizado ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'}`}>
            <Layers className="w-3.5 h-3.5" />
            {isPersonalizado ? 'Modelo Personalizado' : 'Modelo Padrão'}
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImprimirDialog(true)}>
            <Printer className="w-4 h-4" /> Imprimir Ranking
          </Button>
        </div>
      </div>

      {/* Filtro período — fixo */}
      <div className="flex-shrink-0 bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <button onClick={() => setUseDateRange(false)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${!useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
              Por Trimestre
            </button>
            <button onClick={() => setUseDateRange(true)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
              Por Intervalo de Datas
            </button>
          </div>
          {(useDateRange ? (dataInicio || dataFim) : false) && (
            <Button variant="ghost" size="sm" onClick={() => { setDataInicio(''); setDataFim(''); }} className="gap-1 text-destructive text-xs h-7">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>
        {!useDateRange ? (
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {getAllPeriodos().map(p => <SelectItem key={p} value={p}>{getPeriodoLabel(p)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="mt-1 w-44" />
            </div>
            <div>
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="mt-1 w-44" />
            </div>
          </div>
        )}
      </div>

      {/* Level tabs */}
      <div className="flex-shrink-0">
        {isPersonalizado ? (
          <Tabs value={grupoTipo} onValueChange={setGrupoTipo}>
            <TabsList>
              <TabsTrigger value="todos">Todos os Grupos</TabsTrigger>
              <TabsTrigger value="companhia">CIA</TabsTrigger>
              <TabsTrigger value="pelotao">Pelotão</TabsTrigger>
              <TabsTrigger value="gpm">GPM</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <Tabs value={level} onValueChange={setLevel}>
            <TabsList>
              <TabsTrigger value="municipio">Município</TabsTrigger>
              <TabsTrigger value="bpm">BPM</TabsTrigger>
              <TabsTrigger value="companhia">CIA</TabsTrigger>
              <TabsTrigger value="pelotao">Pelotão</TabsTrigger>
              <TabsTrigger value="gpm">GPM</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Top 3 highlight — fixo */}
      {ranking.length >= 3 && (
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
          {ranking.slice(0, 3).map((item, i) => {
            const m = medals[i];
            return (
              <div key={`podio-${i}-${item.name || item.id || ''}`} className={`rounded-xl border-2 ${m.bg} p-4 text-center`}>
                <m.icon className={`w-8 h-8 mx-auto ${m.color}`} />
                <p className="text-xs font-medium text-muted-foreground mt-2 uppercase tracking-wider">{m.label}</p>
                <h3 className="text-base font-bold mt-1">
                  {isPersonalizado
                    ? item.name
                    : level === 'municipio'
                      ? item.municipio
                      : item.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPersonalizado
                    ? (item.observacao || item.municipios || '—')
                    : level === 'municipio'
                      ? (item.opmLabel || '—')
                      : (municipioSeNaoRepetido(item.name, item.municipio) || '—')}
                </p>
                <p className="text-2xl font-black mt-2">{formatNumber(item.score)}</p>
                <p className="text-xs text-muted-foreground">pontos</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ranking table — rola */}
      <div className="flex-1 min-h-0 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider">#</th>
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider">
                  {isPersonalizado ? 'Grupo / Municípios' : level === 'municipio' ? 'Município / OPM' : `${levelLabel} / Município`}
                </th>
                <th className="text-right px-2 py-3 font-semibold text-xs uppercase tracking-wider text-blue-600">Prev.</th>
                <th className="text-right px-2 py-3 font-semibold text-xs uppercase tracking-wider text-red-600">Repr.</th>
                <th className="text-right px-2 py-3 font-semibold text-xs uppercase tracking-wider text-orange-600">Apre.</th>
                <th className="text-right px-2 py-3 font-semibold text-xs uppercase tracking-wider text-green-600">Aten.</th>
                <th className="text-right px-2 py-3 font-semibold text-xs uppercase tracking-wider text-purple-600">Econ.</th>
                <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranking.map((item, index) => (
                <tr key={`row-${index}-${item.name || item.id || ''}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5">
                    {index < 3 ? <Star className={`w-4 h-4 ${medals[index].color}`} /> : <span className="text-muted-foreground text-xs">{index + 1}º</span>}
                  </td>
                  <td className="px-3 py-2.5">
                     {isPersonalizado ? (
                         <div>
                           <div className="font-medium text-sm">{item.name}</div>
                           {(item.observacao || item.municipios) && (
                             <div className="text-xs text-muted-foreground mt-0.5">{item.observacao || item.municipios}</div>
                           )}
                         </div>
                       ) : (
                       <div>
                         <div className="font-medium text-sm">
                           {level === 'municipio' ? item.municipio : item.name}
                         </div>
                         <div className="text-xs text-muted-foreground mt-0.5">
                           {level === 'municipio'
                             ? (item.opmLabel || '—')
                             : (municipioSeNaoRepetido(item.name, item.municipio) || '—')}
                         </div>
                       </div>
                     )}
                   </td>
                  <td className="px-2 py-2.5 text-right text-xs text-blue-700">{item.preventiva > 0 ? formatNumber(item.preventiva) : '—'}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-red-700">{item.repressiva > 0 ? formatNumber(item.repressiva) : '—'}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-orange-700">{item.apreensao > 0 ? formatNumber(item.apreensao) : '—'}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-green-700">{item.atendimento > 0 ? formatNumber(item.atendimento) : '—'}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-purple-700">{item.economia > 0 ? formatNumber(item.economia) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{formatNumber(item.score)}</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum dado para o período selecionado
                  </td>
                </tr>
              )}
              {ranking.length > 0 && (() => {
                const totals = ranking.reduce((acc, item) => ({
                  score: acc.score + (item.score || 0),
                  preventiva: acc.preventiva + (item.preventiva || 0),
                  repressiva: acc.repressiva + (item.repressiva || 0),
                  apreensao: acc.apreensao + (item.apreensao || 0),
                  atendimento: acc.atendimento + (item.atendimento || 0),
                  economia: acc.economia + (item.economia || 0),
                }), { score: 0, preventiva: 0, repressiva: 0, apreensao: 0, atendimento: 0, economia: 0 });
                return (
                  <tr className="bg-muted/60 border-t-2 border-border font-bold">
                    <td className="px-3 py-3 text-xs text-muted-foreground">—</td>
                    <td className="px-3 py-3 text-sm font-bold uppercase tracking-wide">TOTAL GERAL</td>
                    <td className="px-2 py-3 text-right text-xs text-blue-700 font-bold">{totals.preventiva > 0 ? formatNumber(totals.preventiva) : '—'}</td>
                    <td className="px-2 py-3 text-right text-xs text-red-700 font-bold">{totals.repressiva > 0 ? formatNumber(totals.repressiva) : '—'}</td>
                    <td className="px-2 py-3 text-right text-xs text-orange-700 font-bold">{totals.apreensao > 0 ? formatNumber(totals.apreensao) : '—'}</td>
                    <td className="px-2 py-3 text-right text-xs text-green-700 font-bold">{totals.atendimento > 0 ? formatNumber(totals.atendimento) : '—'}</td>
                    <td className="px-2 py-3 text-right text-xs text-purple-700 font-bold">{totals.economia > 0 ? formatNumber(totals.economia) : '—'}</td>
                    <td className="px-3 py-3 text-right font-black text-base">{formatNumber(totals.score)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {isLoading && (
        <div className="flex-shrink-0 flex justify-center py-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {showImprimirDialog && (
        <ImprimirRankingDialog
          open={showImprimirDialog}
          onClose={() => setShowImprimirDialog(false)}
          allProductions={allProductions}
          organizations={organizations}
          composicoes={composicoes}
          modeloAtivo={modeloAtivo}
          user={user}
        />
      )}
    </div>
  );
}
