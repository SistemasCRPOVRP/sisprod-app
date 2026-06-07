import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const VIEWS = [
  { key: 'diario', label: 'Diário' },
  { key: 'mensal', label: 'Mensal' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'anual', label: 'Anual' },
];

export default function EvolucaoChart({ productions, bpmFilter, ciaFilter, pelFilter, gpmFilter }) {
  const [view, setView] = useState('mensal');

  const filtered = useMemo(() => {
    return productions.filter(p => {
      if (bpmFilter && p.bpm !== bpmFilter) return false;
      if (ciaFilter && p.companhia !== ciaFilter) return false;
      if (pelFilter && p.pelotao !== pelFilter) return false;
      if (gpmFilter && p.gpm !== gpmFilter) return false;
      return true;
    });
  }, [productions, bpmFilter, ciaFilter, pelFilter, gpmFilter]);

  const chartData = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      if (!p.data) return;
      let key;
      try {
        const d = parseISO(p.data);
        if (view === 'diario') key = format(d, 'dd/MM/yyyy');
        else if (view === 'mensal') key = format(d, 'MM/yyyy');
        else if (view === 'trimestral') {
          const t = Math.ceil((d.getMonth() + 1) / 3);
          key = `T${t}/${d.getFullYear()}`;
        } else key = String(d.getFullYear());
      } catch { return; }

      if (!map[key]) map[key] = { periodo: key, pontuacao: 0, lancamentos: 0 };
      map[key].pontuacao += (p.pontuacao || 0);
      map[key].lancamentos += 1;
    });
    return Object.values(map).slice(-20); // últimos 20 períodos
  }, [filtered, view]);

  if (filtered.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center h-40">
        <p className="text-sm text-muted-foreground">Sem dados para exibir. Aplique filtros de unidade.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {bpmFilter || ciaFilter || pelFilter || gpmFilter
            ? `${[bpmFilter, ciaFilter, pelFilter, gpmFilter].filter(Boolean).join(' › ')}`
            : 'CRPM/VRP — Todos'}
        </p>
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="h-7">
            {VIEWS.map(v => (
              <TabsTrigger key={v.key} value={v.key} className="text-xs px-2 h-6">{v.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v, name) => [v.toLocaleString('pt-BR'), name === 'pontuacao' ? 'Pontuação' : 'Lançamentos']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend formatter={v => v === 'pontuacao' ? 'Pontuação' : 'Lançamentos'} wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="pontuacao" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="lancamentos" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
