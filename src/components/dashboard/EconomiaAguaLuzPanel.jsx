import React, { useMemo } from 'react';
import { Droplets, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';

const IS_AGUA = (nome) => (nome || '').toLowerCase().includes('água') || (nome || '').toLowerCase().includes('agua');
const IS_LUZ  = (nome) => (nome || '').toLowerCase().includes('luz') || (nome || '').toLowerCase().includes('energia');

function extrairConsumoAtual(obs) {
  if (!obs) return null;
  const m = obs.match(/Atual\s*\([^)]*\):\s*([\d.,]+)\s*(?:m³|kWh)/i);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

function extrairVariacao(obs) {
  const antMatch      = obs.match(/Ant[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const atualMatch    = obs.match(/Atual[^:]*:\s*([\d.,]+)\s*(?:m³|kWh)/i);
  const doisAtrasMatch = obs.match(/([\d.,]+)\s*(?:m³|kWh)\s*\|\s*Ant/i);
  const ant      = antMatch      ? parseFloat(antMatch[1].replace(',', '.'))      : null;
  const atual    = atualMatch    ? parseFloat(atualMatch[1].replace(',', '.'))    : null;
  const doisAtras = doisAtrasMatch ? parseFloat(doisAtrasMatch[1].replace(',', '.')) : null;
  const varB = ant != null && atual != null ? atual - ant : null;
  const varA = doisAtras != null && ant != null ? ant - doisAtras : null;
  const delta = varB !== null && varA !== null ? varB - varA : varB;
  return { ant, atual, doisAtras, varB, varA, delta };
}

function EconomiaSectionCard({ titulo, icon: SectionIcon, unidade, producoes, borderClass, bgClass, textClass }) {
  // Soma total de consumo atual (último mês lançado por unidade)
  const totalConsumoAtual = useMemo(() => {
    return producoes.reduce((s, p) => {
      const v = extrairConsumoAtual(p.observacao || '');
      return s + (v != null ? v : 0);
    }, 0);
  }, [producoes]);

  // Pontuação total
  const totalPts = useMemo(() => producoes.reduce((s, p) => s + (p.pontuacao || 0), 0), [producoes]);

  // Unidades que melhoraram (delta < 0) vs pioraram
  const melhoraram = useMemo(() => producoes.filter(p => {
    const v = extrairVariacao(p.observacao || '');
    return v.delta !== null && v.delta < 0;
  }).length, [producoes]);

  // Rankings por unidade (soma do consumo atual mais recente)
  const rankingUnidades = useMemo(() => {
    const map = {};
    producoes.forEach(p => {
      const org = p.organization_name || p.bpm || '?';
      const consumo = extrairConsumoAtual(p.observacao || '');
      if (!map[org]) map[org] = { org, pontos: 0, registros: 0 };
      map[org].pontos += (p.pontuacao || 0);
      map[org].registros += 1;
      if (consumo != null) map[org].consumoAtual = consumo;
    });
    return Object.values(map).sort((a, b) => b.pontos - a.pontos).slice(0, 8);
  }, [producoes]);

  // Histórico mensal (soma de consumo atual por mês)
  const historicMensal = useMemo(() => {
    const map = {};
    producoes.forEach(p => {
      const mes = p.data ? p.data.substring(0, 7) : 'sem-data';
      const consumo = extrairConsumoAtual(p.observacao || '');
      if (!map[mes]) map[mes] = { mes, consumo: 0, pts: 0 };
      if (consumo != null) map[mes].consumo += consumo;
      map[mes].pts += (p.pontuacao || 0);
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6);
  }, [producoes]);

  return (
    <div className={`rounded-xl border-2 ${borderClass} ${bgClass} p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {React.createElement(SectionIcon, { className: `w-5 h-5 ${textClass}` })}
          <h4 className={`font-bold text-sm ${textClass}`}>{titulo}</h4>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full bg-white/60 ${textClass}`}>
          {unidade}
        </span>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white/60 rounded-lg p-2">
          <p className="text-xs text-muted-foreground">Registros</p>
          <p className={`text-lg font-black ${textClass}`}>{producoes.length}</p>
        </div>
        <div className="bg-white/60 rounded-lg p-2">
          <p className="text-xs text-muted-foreground">Pontuação</p>
          <p className={`text-lg font-black ${textClass}`}>{totalPts}</p>
        </div>
        <div className="bg-white/60 rounded-lg p-2">
          <p className="text-xs text-muted-foreground">Melhoraram</p>
          <p className="text-lg font-black text-green-700">{melhoraram}</p>
        </div>
      </div>

      {/* Ranking de unidades */}
      {rankingUnidades.length > 0 && (
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textClass} opacity-70`}>Ranking de economia</p>
          <div className="space-y-1">
            {rankingUnidades.map((u, i) => (
              <div key={u.org} className="flex items-center justify-between text-xs bg-white/50 rounded px-2 py-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`font-bold flex-shrink-0 ${textClass} opacity-60`}>{i + 1}º</span>
                  <span className="truncate font-medium">{u.org.replace(/\s*—\s*.+$/, '').trim()}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {u.consumoAtual != null && (
                    <span className="text-muted-foreground font-mono text-[10px]">{u.consumoAtual.toLocaleString('pt-BR')} {unidade}</span>
                  )}
                  <span className={`font-bold ${textClass}`}>{u.pontos} pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico mensal simplificado */}
      {historicMensal.length > 1 && (
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textClass} opacity-70`}>Histórico mensal</p>
          <div className="space-y-1">
            {historicMensal.map((m, i) => {
              const prev = i > 0 ? historicMensal[i - 1] : null;
              const delta = prev ? m.consumo - prev.consumo : null;
              return (
                <div key={m.mes} className="flex items-center justify-between text-xs bg-white/50 rounded px-2 py-1">
                  <span className="font-mono text-muted-foreground">{m.mes}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{m.consumo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {unidade}</span>
                    {delta !== null && (
                      <span className={`flex items-center gap-0.5 font-bold ${delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {delta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {producoes.length === 0 && (
        <p className="text-xs text-center text-muted-foreground py-4">Nenhum lançamento de {titulo.toLowerCase()} no período</p>
      )}
    </div>
  );
}

export default function EconomiaAguaLuzPanel({ productions }) {
  const aguaProds = useMemo(() => productions.filter(p => p.categoria === 'Economia' && IS_AGUA(p.indicator_name)), [productions]);
  const luzProds  = useMemo(() => productions.filter(p => p.categoria === 'Economia' && IS_LUZ(p.indicator_name)),  [productions]);

  const totalPtsAgua = aguaProds.reduce((s, p) => s + (p.pontuacao || 0), 0);
  const totalPtsLuz  = luzProds.reduce((s, p)  => s + (p.pontuacao || 0), 0);

  return (
    <div className="space-y-4">
      {/* Cabeçalho combinado */}
      <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-500" />
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold">Economia de Água e Luz</span>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-blue-700 font-semibold">{totalPtsAgua} pts água</span>
          <span className="text-yellow-700 font-semibold">{totalPtsLuz} pts luz</span>
          <span className="font-bold">{totalPtsAgua + totalPtsLuz} pts total</span>
        </div>
      </div>

      {/* Seções separadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EconomiaSectionCard
          titulo="Água"
          unidade="m³"
          icon={Droplets}
          producoes={aguaProds}
          borderClass="border-blue-200"
          bgClass="bg-blue-50"
          textClass="text-blue-700"
        />
        <EconomiaSectionCard
          titulo="Luz / Energia"
          unidade="kWh"
          icon={Lightbulb}
          producoes={luzProds}
          borderClass="border-yellow-200"
          bgClass="bg-yellow-50"
          textClass="text-yellow-700"
        />
      </div>
    </div>
  );
}
