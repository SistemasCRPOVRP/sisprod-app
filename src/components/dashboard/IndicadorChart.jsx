import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = [
  '#1a5c30', '#2d8a4e', '#3b82f6', '#ef4444', '#f97316',
  '#22c55e', '#a855f7', '#eab308', '#06b6d4', '#ec4899',
];

export default function IndicadorChart({ productions }) {
  if (!productions || productions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 h-64 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
      </div>
    );
  }

  // Agrupar por indicador
  const map = {};
  productions.forEach(p => {
    const k = p.indicator_name || 'Sem indicador';
    map[k] = (map[k] || 0) + (p.pontuacao || 0);
  });

  const data = Object.entries(map)
    .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 18) + '…' : name, fullName: name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(140, 10%, 88%)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
          <Tooltip
            formatter={(v, _, props) => [v.toLocaleString('pt-BR') + ' pts', props.payload?.fullName || props.payload?.name]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}