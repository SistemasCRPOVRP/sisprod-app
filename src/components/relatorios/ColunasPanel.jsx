import React from 'react';
import { Settings2, X, RotateCcw, CheckSquare, Square } from 'lucide-react';

const COLUNAS_DISPONIVEIS = [
  { key: 'data',             label: 'Data' },
  { key: 'organization_name',label: 'Unidade' },
  { key: 'municipio',        label: 'Município' },
  { key: 'indicator_name',   label: 'Indicador' },
  { key: 'categoria',        label: 'Categoria' },
  { key: 'quantidade',       label: 'Quantidade' },
  { key: 'unidade_medida',   label: 'Unidade de Medida' },
  { key: 'pontuacao',        label: 'Pontuação' },
];

const COLUNAS_DEFAULT = new Set(['data', 'organization_name', 'municipio', 'indicator_name', 'categoria', 'quantidade', 'unidade_medida', 'pontuacao']);

export { COLUNAS_DISPONIVEIS, COLUNAS_DEFAULT };

export default function ColunasPanel({ colunasAtivas, onToggle, onReset, onClose }) {
  const allSelected = COLUNAS_DISPONIVEIS.every(c => colunasAtivas.has(c.key));

  const toggleAll = () => {
    if (allSelected) {
      // deixa só a primeira
      onReset(new Set([COLUNAS_DISPONIVEIS[0].key]));
    } else {
      onReset(new Set(COLUNAS_DISPONIVEIS.map(c => c.key)));
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-md w-full lg:w-52 xl:w-56 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Colunas</span>
          <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
            {colunasAtivas.size}/{COLUNAS_DISPONIVEIS.length}
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista de colunas */}
      <div className="p-2 space-y-0.5">
        {COLUNAS_DISPONIVEIS.map(col => {
          const ativa = colunasAtivas.has(col.key);
          return (
            <label
              key={col.key}
              className={`flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 transition-colors select-none
                ${ativa ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'}`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                ${ativa ? 'bg-primary border-primary' : 'border-border'}`}>
                {ativa && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span className={`text-xs ${ativa ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{col.label}</span>
              <input type="checkbox" className="sr-only" checked={ativa} onChange={() => onToggle(col.key)} />
            </label>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5">
        <button
          onClick={toggleAll}
          className="w-full text-[11px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 rounded hover:bg-muted/30 transition-colors"
        >
          {allSelected ? <Square className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
          {allSelected ? 'Desmarcar todas' : 'Marcar todas'}
        </button>
        <button
          onClick={() => onReset(COLUNAS_DEFAULT)}
          className="w-full text-[11px] text-primary hover:text-primary/80 flex items-center justify-center gap-1 py-1 rounded hover:bg-primary/5 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Padrão
        </button>
      </div>
    </div>
  );
}