import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Target, Users, ShieldCheck, Zap, X, Layers, MapPin, User } from 'lucide-react';
import { getCurrentPeriodo, getPeriodoLabel, getAllPeriodos, formatNumber } from '@/lib/utils';
import {
  useAllProductions, useIndicators,
  computeRankings, computeCategoryBreakdown,
  computeComposicaoRanking, computeMunicipalRanking,
} from '@/hooks/useProduction';
import { useRankingConfig } from '@/hooks/useRankingConfig';
import { BPMs, getCias, getPelotoes, getGPMs } from '@/lib/orgData';
import StatCard from '@/components/dashboard/StatCard';
import RankingTable from '@/components/dashboard/RankingTable';
import CategoryChart from '@/components/dashboard/CategoryChart';
import EvolucaoChart from '@/components/dashboard/EvolucaoChart';
import IndicadorChart from '@/components/dashboard/IndicadorChart';
import EvolucaoCategoriaChart from '@/components/dashboard/EvolucaoCategoriaChart';
import EconomiaAguaLuzPanel from '@/components/dashboard/EconomiaAguaLuzPanel';

// Visualização inicial conforme modeloAtivo
function getVisualizacaoInicial(modeloAtivo) {
  if (modeloAtivo === 'personalizado') return 'grupos';
  return 'opm';
}

export default function Dashboard() {
  const { appUser } = useOutletContext();
  const [periodo, setPeriodo] = useState(getCurrentPeriodo());
  const [useDateRange, setUseDateRange] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [bpmFilter, setBpmFilter] = useState('');
  const [ciaFilter, setCiaFilter] = useState('');
  const [pelFilter, setPelFilter] = useState('');
  const [gpmFilter, setGpmFilter] = useState('');

  const { data: allProductionsRaw, isLoading } = useAllProductions();
  const { data: indicators } = useIndicators();
  const { modeloAtivo, composicoes } = useRankingConfig();
  const isPersonalizado = modeloAtivo === 'personalizado' && composicoes.length > 0;

  // Visualização: 'grupos' | 'municipio' | 'opm'
  // Inicializa conforme modeloAtivo (carregado), mas permite alteração local
  const [visualizacao, setVisualizacao] = useState(() => getVisualizacaoInicial(modeloAtivo));

  // Sincroniza ao carregar modeloAtivo pela primeira vez (quando ainda era null)
  const [visualizacaoSincronizada, setVisualizacaoSincronizada] = useState(false);
  useEffect(() => {
    if (!visualizacaoSincronizada && modeloAtivo) {
      setVisualizacao(getVisualizacaoInicial(modeloAtivo));
      setVisualizacaoSincronizada(true);
    }
  }, [modeloAtivo, visualizacaoSincronizada]);

  const [rankingLevel, setRankingLevel] = useState('gpm');

  const cias = getCias(bpmFilter);
  const pelotoes = getPelotoes(bpmFilter, ciaFilter);
  const gpms = getGPMs(bpmFilter, ciaFilter, pelFilter);

  // Filtragem centralizada — mesma lógica usada no Ranking
  const filtered = useMemo(() => {
    return allProductionsRaw.filter(p => {
      if (useDateRange) {
        if (dataInicio && p.data && p.data < dataInicio) return false;
        if (dataFim && p.data && p.data > dataFim) return false;
      } else {
        if (periodo && p.periodo !== periodo) return false;
      }
      if (bpmFilter && p.bpm !== bpmFilter) return false;
      if (ciaFilter && p.companhia !== ciaFilter) return false;
      if (pelFilter && p.pelotao !== pelFilter) return false;
      if (gpmFilter && p.gpm !== gpmFilter) return false;
      return true;
    });
  }, [allProductionsRaw, periodo, useDateRange, dataInicio, dataFim, bpmFilter, ciaFilter, pelFilter, gpmFilter]);

  // Seletor de indicador para o card Qtd. Indicadores
  const [indicadorSelecionado, setIndicadorSelecionado] = useState('__todos__');
  const [showIndicadorDropdown, setShowIndicadorDropdown] = useState(false);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!showIndicadorDropdown) return;
    const handler = () => setShowIndicadorDropdown(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIndicadorDropdown]);

  // Stats — pontos = soma exclusiva de pontuacao
  const totalPontos = filtered.reduce((s, p) => s + (p.pontuacao || 0), 0);
  const totalLancamentos = filtered.length;
  const totalUnidades = new Set(filtered.map(p => p.organization_id)).size;
  const totalQuantidade = indicadorSelecionado === '__todos__'
    ? filtered.reduce((s, p) => s + (p.quantidade || 0), 0)
    : filtered.filter(p => p.indicator_id === indicadorSelecionado).reduce((s, p) => s + (p.quantidade || 0), 0);

  const indicadoresFiltrados = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      if (p.indicator_id && p.indicator_name) {
        map[p.indicator_id] = p.indicator_name;
      }
    });
    return Object.entries(map).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filtered]);

  const indicadorLabel = indicadorSelecionado === '__todos__'
    ? 'Todos os Indicadores'
    : indicadoresFiltrados.find(i => i.id === indicadorSelecionado)?.nome || 'Indicador';

  // Ranking para exibição lateral — depende da visualização selecionada
  const rankingData = useMemo(() => {
    if (visualizacao === 'grupos' && isPersonalizado) {
      // Modo grupos: usa computeComposicaoRanking para o ranking lateral (pontos por grupo)
      return computeComposicaoRanking(filtered, composicoes);
    }
    if (visualizacao === 'municipio') {
      return computeMunicipalRanking(filtered);
    }
    // OPM individual — usa nível selecionado
    return computeRankings(filtered, [], rankingLevel);
  }, [filtered, visualizacao, isPersonalizado, composicoes, rankingLevel]);

  const categoryData = computeCategoryBreakdown(filtered);

  // Indicadores por categoria — quantidade por indicador (soma exclusiva por indicador)
  const cats = ['Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];
  const catBreakdown = cats.map(cat => ({
    cat,
    items: filtered.filter(p => p.categoria === cat),
    total: filtered.filter(p => p.categoria === cat).reduce((s, p) => s + (p.pontuacao || 0), 0),
  })).filter(c => c.items.length > 0);

  const catColors = {
    Preventiva: 'bg-blue-50 border-blue-200 text-blue-800',
    Repressiva: 'bg-red-50 border-red-200 text-red-800',
    'Apreensão': 'bg-orange-50 border-orange-200 text-orange-800',
    Atendimento: 'bg-green-50 border-green-200 text-green-800',
    Economia: 'bg-purple-50 border-purple-200 text-purple-800',
  };

  // Label do seletor de visualização
  const vizLabels = {
    grupos: 'Por Grupo Concorrente',
    municipio: 'Por Município',
    opm: 'Por OPM Individual',
  };

  const rankingTitle = {
    grupos: '🏆 Ranking por Grupo',
    municipio: '🏆 Ranking por Município',
    opm: `🏆 Ranking por ${{ bpm: 'BPM', companhia: 'CIA', pelotao: 'Pelotão', gpm: 'GPM' }[rankingLevel]}`,
  }[visualizacao];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da produtividade operacional</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${isPersonalizado ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'}`}>
          <Layers className="w-3.5 h-3.5" />
          {isPersonalizado ? 'Somente Grupos' : 'OPMs Individuais'}
        </div>
      </div>

      {/* Seletor de Visualização */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Visualização dos Dados
        </p>
        <div className="flex flex-wrap gap-2">
          {isPersonalizado && (
            <button
              onClick={() => setVisualizacao('grupos')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${visualizacao === 'grupos' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
            >
              <Users className="w-3 h-3" /> Por Grupo Concorrente
            </button>
          )}
          <button
            onClick={() => setVisualizacao('municipio')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${visualizacao === 'municipio' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
          >
            <MapPin className="w-3 h-3" /> Por Município
          </button>
          <button
            onClick={() => setVisualizacao('opm')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${visualizacao === 'opm' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
          >
            <User className="w-3 h-3" /> Por OPM Individual
          </button>
        </div>
        {visualizacao === 'opm' && (
          <div className="mt-3">
            <Tabs value={rankingLevel} onValueChange={setRankingLevel} className="w-full">
              <TabsList className="grid grid-cols-4 text-xs w-full sm:w-auto">
                <TabsTrigger value="bpm" className="text-xs">BPM</TabsTrigger>
                <TabsTrigger value="companhia" className="text-xs">CIA</TabsTrigger>
                <TabsTrigger value="pelotao" className="text-xs">Pelotão</TabsTrigger>
                <TabsTrigger value="gpm" className="text-xs">GPM</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* Filtro período */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <button onClick={() => setUseDateRange(false)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${!useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
              Por Trimestre
            </button>
            <button onClick={() => setUseDateRange(true)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${useDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
              Por Intervalo de Datas
            </button>
          </div>
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
            {(dataInicio || dataFim) && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={() => { setDataInicio(''); setDataFim(''); }} className="gap-1 text-destructive text-xs h-9">
                  <X className="w-3.5 h-3.5" /> Limpar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtros de unidade */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtrar por Unidade (CRPM/VRP)</p>
          {(bpmFilter || ciaFilter || pelFilter || gpmFilter) && (
            <button
              onClick={() => { setBpmFilter(''); setCiaFilter(''); setPelFilter(''); setGpmFilter(''); }}
              className="text-xs text-destructive hover:text-destructive/80 font-semibold flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select value={bpmFilter} onValueChange={v => { setBpmFilter(v); setCiaFilter(''); setPelFilter(''); setGpmFilter(''); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos BTLs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>CRPM/VRP (Todos)</SelectItem>
              {BPMs.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ciaFilter} onValueChange={v => { setCiaFilter(v); setPelFilter(''); setGpmFilter(''); }} disabled={!bpmFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas Cias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todas Cias</SelectItem>
              {cias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pelFilter} onValueChange={v => { setPelFilter(v); setGpmFilter(''); }} disabled={!ciaFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos Pels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos Pels</SelectItem>
              {pelotoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gpmFilter} onValueChange={setGpmFilter} disabled={!pelFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos GPMs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos GPMs</SelectItem>
              {gpms.map(g => <SelectItem key={g.nome} value={g.nome}>{g.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pontuação Total" value={totalPontos} icon={Target} color="primary" />
        <StatCard title="Lançamentos" value={totalLancamentos} icon={Zap} color="accent" />
        <StatCard title="Unidades Ativas" value={totalUnidades} icon={Users} color="blue" />
        {/* Card de Quantidade com seletor de indicador */}
        <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow relative">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qtd. Indicadores</p>
                <button
                  onClick={() => setShowIndicadorDropdown(v => !v)}
                  className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 flex-shrink-0"
                  title="Selecionar indicador"
                >
                  ▾ {indicadorSelecionado === '__todos__' ? 'todos' : '1 selecionado'}
                </button>
              </div>
              <p className="text-2xl font-bold mt-1">{totalQuantidade.toLocaleString('pt-BR')}</p>
              {indicadorSelecionado !== '__todos__' && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{indicadorLabel}</p>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          {/* Dropdown de seleção */}
          {showIndicadorDropdown && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
              <button
                onClick={() => { setIndicadorSelecionado('__todos__'); setShowIndicadorDropdown(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors border-b border-border font-semibold ${indicadorSelecionado === '__todos__' ? 'text-primary bg-primary/5' : ''}`}
              >
                ✓ Todos os Indicadores
              </button>
              {indicadoresFiltrados.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => { setIndicadorSelecionado(ind.id); setShowIndicadorDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${indicadorSelecionado === ind.id ? 'text-primary bg-primary/5 font-semibold' : ''}`}
                >
                  {indicadorSelecionado === ind.id ? '✓ ' : ''}{ind.nome}
                </button>
              ))}
              {indicadoresFiltrados.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum indicador no período</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Gráficos + Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Pontuação por Categoria</h3>
            <CategoryChart data={categoryData} type="bar" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Pontuação por Indicador</h3>
            <IndicadorChart productions={filtered} />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Comparação Mensal por Categoria</h3>
            <EvolucaoCategoriaChart productions={allProductionsRaw} bpmFilter={bpmFilter} ciaFilter={ciaFilter} pelFilter={pelFilter} gpmFilter={gpmFilter} />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Evolução da Produção</h3>
            <EvolucaoChart productions={allProductionsRaw} bpmFilter={bpmFilter} ciaFilter={ciaFilter} pelFilter={pelFilter} gpmFilter={gpmFilter} />
          </div>
        </div>
        <div className="space-y-6">
          <RankingTable data={rankingData.slice(0, 15)} title={rankingTitle} />

          {/* Indicadores por categoria — quantidade exclusiva por indicador */}
          {cats.map(cat => {
            const inds = (indicators || []).filter(i => i.categoria === cat && i.status !== 'inativo');
            if (inds.length === 0) return null;
            const byInd = inds.map(ind => {
              // Soma exclusiva da quantidade deste indicador
              const qtd = filtered.filter(p => p.indicator_id === ind.id).reduce((s, p) => s + (p.quantidade || 0), 0);
              return { nome: ind.nome, qtd };
            }).filter(x => x.qtd > 0).sort((a, b) => b.qtd - a.qtd);
            if (byInd.length === 0) return null;
            const catBg = {
              Preventiva: 'bg-blue-50 border-blue-200',
              Repressiva: 'bg-red-50 border-red-200',
              'Apreensão': 'bg-orange-50 border-orange-200',
              Atendimento: 'bg-green-50 border-green-200',
              Economia: 'bg-purple-50 border-purple-200',
            };
            return (
              <div key={cat} className={`rounded-xl border p-4 ${catBg[cat] || 'bg-card border-border'}`}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">{cat}</p>
                <div className="space-y-1.5">
                  {byInd.map(({ nome, qtd }) => (
                    <div key={nome} className="flex items-center justify-between text-xs">
                      <span className="truncate mr-2 font-medium leading-tight">{nome}</span>
                      <span className="font-black text-sm flex-shrink-0">{qtd.toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdown por Categoria */}
      {catBreakdown.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Detalhamento por Categoria</h3>
          {catBreakdown.map(({ cat, items, total }) => {
            // Agrupa por indicador — pontos e quantidade SEPARADOS
            const byIndicator = items.reduce((acc, p) => {
              const k = p.indicator_name || 'Sem indicador';
              if (!acc[k]) acc[k] = { qtd: 0, pts: 0 };
              acc[k].qtd += (p.quantidade || 0);   // soma de quantidade (indicador)
              acc[k].pts += (p.pontuacao || 0);    // soma de pontos (pontuação)
              return acc;
            }, {});

            return (
              <div key={cat} className={`rounded-xl border p-4 ${catColors[cat] || 'bg-card border-border'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm">{cat}</h4>
                  <span className="font-black text-lg">{formatNumber(total)} pts</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(byIndicator).sort((a, b) => b[1].qtd - a[1].qtd).map(([ind, data]) => (
                    <div key={ind} className="bg-white/60 rounded-lg p-2 text-xs">
                      <p className="font-medium leading-tight mb-1 line-clamp-2">{ind}</p>
                      <p className="font-bold text-base">{formatNumber(data.qtd)}</p>
                      <p className="text-[10px] opacity-70">{formatNumber(data.pts)} pts</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Painel Água e Luz */}
      {filtered.some(p => p.categoria === 'Economia') && (
        <EconomiaAguaLuzPanel productions={filtered} />
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
