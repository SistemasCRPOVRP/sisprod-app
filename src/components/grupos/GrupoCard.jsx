import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronRight, Pencil, Trash2, Power,
  Building2, Users, User, Shield, Loader2, EyeOff, Copy
} from 'lucide-react';
import { calcResumoUnidades } from '@/lib/municipioOPMs';

export default function GrupoCard({ grupo, idx, onEdit, onDelete, onToggleStatus, onDuplicate, isToggling }) {
  const [expanded, setExpanded] = useState(false);
  const unidades = grupo.unidades_vinculadas || [];
  const participantes = grupo.municipios_participantes || [];
  const resumo = calcResumoUnidades(unidades);
  const isAtivo = grupo.status !== 'inativo';

  // Componentes por status
  const ativos    = participantes.filter(p => !p.excluida && p.ativa !== false);
  const inativos  = participantes.filter(p => !p.excluida && p.ativa === false);
  const excluidos = participantes.filter(p => p.excluida);

  // Árvore CIA → Pel → GPM para exibição
  const tree = {};
  unidades.forEach(u => {
    if (u.nivel === 'bpm') return;
    const cia = u.companhia || '—';
    if (!tree[cia]) tree[cia] = { municipio: u.municipio, pels: {} };
    const pel = u.pelotao || '—';
    if (!tree[cia].pels[pel]) tree[cia].pels[pel] = { municipio: u.municipio, gpms: [] };
    if (u.nivel === 'gpm' && u.gpm) {
      tree[cia].pels[pel].gpms.push({ nome: u.gpm, municipio: u.municipio });
    }
  });

  const bpmNome = unidades.find(u => u.nivel === 'bpm')?.bpm || null;
  const municipios = [...new Set(participantes.filter(p => !p.excluida && p.ativa !== false).map(p => p.municipio).filter(Boolean))];

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${isAtivo ? 'border-border' : 'border-border/40 opacity-60'}`}>
      {/* ── Cabeçalho ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {grupo.ordem || idx + 1}
        </span>
        <span className="text-muted-foreground flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${!isAtivo ? 'line-through text-muted-foreground' : ''}`}>
              {grupo.nome}
            </span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isAtivo ? 'bg-green-50 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
              {isAtivo ? 'Ativo' : 'Inativo'}
            </Badge>
            {ativos.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                {ativos.length} componente{ativos.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {inativos.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                {inativos.length} inativo{inativos.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Municípios participantes */}
          {municipios.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {municipios.join(' · ')}
            </p>
          )}
          {grupo.observacao && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate italic">{grupo.observacao}</p>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost" size="icon"
            className={`h-7 w-7 ${isAtivo ? 'text-green-600' : 'text-muted-foreground'}`}
            title={isAtivo ? 'Desativar grupo' : 'Ativar grupo'}
            onClick={() => onToggleStatus(grupo)}
            disabled={isToggling}
          >
            {isToggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => onEdit(grupo)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {onDuplicate && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Duplicar" onClick={() => onDuplicate(grupo)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" title="Excluir" onClick={() => onDelete(grupo)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Detalhe expandido ── */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/5 space-y-3">
          {unidades.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma unidade ativa vinculada.</p>
          ) : (
            <>
              {/* Resumo de unidades */}
              <div className="flex gap-3 flex-wrap">
                {resumo.cias > 0 && (
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">{resumo.cias} CIA{resumo.cias !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {resumo.pels > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-700">{resumo.pels} Pel{resumo.pels !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {resumo.gpms > 0 && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-orange-500" />
                    <span className="text-xs font-semibold text-orange-700">{resumo.gpms} GPM{resumo.gpms !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{resumo.total} unidades ativas</span>
              </div>

              {/* Árvore hierárquica */}
              <div className="space-y-1.5">
                {bpmNome && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-purple-600" />
                    <span className="text-xs font-bold text-purple-700">{bpmNome}</span>
                  </div>
                )}
                {Object.entries(tree).map(([cia, { municipio: ciaMun, pels }]) => (
                  <div key={cia} className={bpmNome ? 'ml-4' : ''}>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-semibold text-green-700">{cia}</span>
                      {ciaMun && <span className="text-[10px] text-muted-foreground">· {ciaMun}</span>}
                    </div>
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {Object.entries(pels).map(([pel, { municipio: pelMun, gpms }]) => (
                        <div key={pel}>
                          <div className="flex items-center gap-1">
                            <Users className="w-2.5 h-2.5 text-blue-500" />
                            <span className="text-[11px] font-medium text-blue-700">{pel}</span>
                            {pelMun && pelMun !== ciaMun && <span className="text-[10px] text-muted-foreground">· {pelMun}</span>}
                          </div>
                          {gpms.length > 0 && (
                            <div className="ml-4 flex flex-wrap gap-1 mt-0.5">
                              {gpms.map(g => (
                                <span key={g.nome} className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 text-foreground">
                                  {g.nome}
                                  {g.municipio && g.municipio !== pelMun && (
                                    <span className="text-muted-foreground ml-0.5">· {g.municipio}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status especiais */}
              {inativos.length > 0 && (
                <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <EyeOff className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span><strong>Inativos (não pontuam):</strong> {inativos.map(p => p.nome_sugerido || p.municipio || p.gpm || p.pelotao || p.companhia).join(', ')}</span>
                </div>
              )}
              {excluidos.length > 0 && (
                <div className="flex items-start gap-1.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  <span><strong>Excluídos:</strong> {excluidos.map(p => p.nome_sugerido || p.municipio || p.gpm || p.pelotao || p.companhia).join(', ')}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}