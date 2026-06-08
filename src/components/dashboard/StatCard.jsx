import React from 'react';
import { cn, formatNumber } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, trend, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent-foreground',
    destructive: 'bg-destructive/10 text-destructive',
    blue: 'bg-blue-500/10 text-blue-600',
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1">{typeof value === 'number' ? formatNumber(value) : value}</p>
          {trend && (
            <p className={cn('text-xs mt-2 font-medium', trend > 0 ? 'text-green-600' : 'text-destructive')}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs período anterior
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('p-2.5 rounded-lg', colorMap[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}