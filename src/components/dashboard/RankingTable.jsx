import React from 'react';
import { formatNumber } from '@/lib/utils';
import { Trophy, Medal, Award } from 'lucide-react';

// Retorna o município apenas se não estiver já contido na cadeia name
function municipioSeNaoRepetido(name, municipio) {
  if (!municipio) return '';
  if (!name) return municipio;
  const partes = name.split('/').map(s => s.trim().toLowerCase());
  if (partes.includes(municipio.trim().toLowerCase())) return '';
  return municipio;
}

const medals = [
  { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-50' },
  { icon: Award, color: 'text-amber-700', bg: 'bg-amber-50' },
];

export default function RankingTable({ data, title, showCategory = false }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-sm mb-4">{title}</h3>
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {data.map((item, index) => {
          const medal = medals[index];
          return (
            <div key={item.name || index} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex-shrink-0 w-8 text-center">
                {medal ? (
                  <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${medal.bg}`}>
                    <medal.icon className={`w-4 h-4 ${medal.color}`} />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">{index + 1}º</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{(item.name || '').replace(/\s*[—\-]\s*.+$/, '').trim()}</p>
                {item.observacao && (
                   <p className="text-xs text-muted-foreground truncate">{item.observacao}</p>
                 )}
                 {!item.observacao && item.municipios && (
                   <p className="text-xs text-muted-foreground truncate">{item.municipios}</p>
                 )}
                 {!item.observacao && !item.municipios && item.opmLabel && (
                   <p className="text-xs text-muted-foreground truncate">{item.opmLabel}</p>
                 )}
                 {!item.observacao && !item.municipios && !item.opmLabel && municipioSeNaoRepetido(item.name, item.municipio) && (
                   <p className="text-xs text-muted-foreground truncate">{municipioSeNaoRepetido(item.name, item.municipio)}</p>
                 )}
                {showCategory && item.category && !item.municipios && !item.municipio && !item.opmLabel && (
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{formatNumber(item.score)}</p>
                <p className="text-[10px] text-muted-foreground">pontos</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
