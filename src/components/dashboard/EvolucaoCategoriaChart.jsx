import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const CAT_COLORS = {
  Preventiva: '#3b82f6',
  Repressiva: '#ef4444',
  'Apreensão': '#f97316',
  Atendimento: '#22c55e',
  Economia: '#a855f7',
};

const CATS = ['Preventiva', 'Repressiva', 'Apreensão', 'Atendimento', 'Economia'];

export default function EvolucaoCategoriaChart({ productions, bpmFilter, ciaFilter, pelFilter, gpmFilter }) {
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
    const totals = {};
    CATS.forEach(c => { totals[c] = 0; });
    filtered.forEach(p => {
      if (p.categoria && totals[p.categoria] !== undefined) {
        totals[p.categoria] += (p.pontuacao || 0);
      }
    });
    return CATS
      .map(cat => ({ name: cat, value: totals[cat] }))
      .filter(d => d.value > 0);
  }, [filtered]);

  if (chartData.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center h-40">
        <p className="text-sm text-muted-foreground">Sem dados suficientes para comparação por categoria.</p>
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={CAT_COLORS[entry.name] || '#64748b'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [v.toLocaleString('pt-BR') + ' pts', name]}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value, entry) => {
              const pct = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : 0;
              return `${value} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}