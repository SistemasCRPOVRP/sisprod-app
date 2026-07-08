import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Download, Info } from 'lucide-react';
import { format } from 'date-fns';

function formatDate(value) {
  try {
    if (!value) return '';
    if (value?.toDate) return format(value.toDate(), 'dd/MM/yyyy');
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

export default function PlanilhasHistoricas() {
  const { data: planilhasRaw = [], isLoading } = useQuery({
    queryKey: ['planilhas-historicas-usuario'],
    queryFn: () => base44.entities.PlanilhaHistorico.list(),
    staleTime: 1000 * 60 * 5,
  });

  const planilhas = [...planilhasRaw].sort(
    (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-primary" /> Backups Trimestrais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Baixe as planilhas com os dados de produtividade de trimestres anteriores
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : planilhas.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center text-center gap-3">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma planilha disponível no momento.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
          {planilhas.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.descricao}</p>
                  {formatDate(p.created_date) && (
                    <p className="text-xs text-muted-foreground">Adicionado em {formatDate(p.created_date)}</p>
                  )}
                </div>
              </div>
              <Button asChild size="sm" className="gap-1.5 flex-shrink-0">
                <a href={p.link} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2.5">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>
          Essas planilhas contêm os lançamentos de trimestres já encerrados, mantidas fora do sistema
          para economizar espaço. O download abre a planilha diretamente no serviço onde ela está hospedada.
        </p>
      </div>
    </div>
  );
}
