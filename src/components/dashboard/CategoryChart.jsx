import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(142, 40%, 28%)', 'hsl(45, 80%, 50%)', 'hsl(200, 60%, 45%)', 'hsl(0, 72%, 51%)', 'hsl(280, 50%, 50%)'];

export default function CategoryChart({ data, type = 'bar' }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 h-64 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
      </div>
    );
  }

  if (type === 'pie') {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => value.toLocaleString('pt-BR')} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(140, 10%, 88%)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => value.toLocaleString('pt-BR')} />
          <Bar dataKey="value" fill="hsl(142, 40%, 28%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}