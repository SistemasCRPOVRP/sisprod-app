import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, Check, ChevronDown, ChevronRight,
  AlertTriangle, Info, Layers, Shield, Power, Building2, Users, User, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { useRankingConfig, useRankingConfigMutations } from '@/hooks/useRankingConfig';
import OrgTree, { selectedKeysToUnidades, unidadesToSelectedKeys, calcComposicaoResumo } from './OrgTree';


function countUnidades(unidades) {
  const us = unidades || [];
  const gpms = us.filter(u => u.nivel === 'gpm').length;
  const pels = [...new Set(us.filter(u => u.pelotao).map(u => `${u.bpm}|${u.companhia}|${u.pelotao}`))].length;
  const cias = [...new Set(us.filter(u => u.companhia).map(u => `${u.bpm}|${u.companhia}`))].length;
  return { gpms, pels, cias };
}

export default function ComposicaoRanking() {
  const { modeloAtivo, composicoes, isLoading } = useRankingConfig();
  const { setModelo, criarComposicao, atualizarComposicao, excluirComposicao } = useRankingConfigMutations();

  const [dialog, setDialog] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const handleToggleModelo = async () => {
    const novo = modeloAtivo === 'padrao' ? 'personalizado' : 'padrao';
    await setModelo.mutateAsync(novo);
    toast.success(novo === 'padrao' ? 'Modelo padrão ativado' : 'Modelo personalizado ativado');
  };

  const handleToggleStatus = async (comp) => {
    const novoStatus = comp.status === 'ativo' ? 'inativo' : 'ativo';
    await atualizarComposicao.mutateAsync({ id: comp.id, data: { ...comp, status: novoStatus } });
    toast.success(novoStatus === 'ativo' ? 'Concorrente ativado' : 'Concorrente desativado');
  };

  const handleDelete = async () => {
    await excluirComposicao.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
    toast.success('Concorrente excluído');
  };

  const sortedComposicoes = useMemo(() =>
    [...composicoes].sort((a, b) => (a.ordem || 99) - (b.ordem || 99)),
    [composicoes]
  );

  return (
    <div className="space-y-6">
      {/* Toggle modelo */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">Modelo de Contabilização</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              Alterne entre o modelo <strong>padrão</strong> (hierarquia original) e o modelo
              <strong> personalizado</strong> (concorrentes definidos abaixo) para ranking e dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Modelo ativo</p>
              <p className={`text-sm font-bold ${modeloAtivo === 'personalizado' ? 'text-primary' : 'text-foreground'}`}>
                {modeloAtivo === 'personalizado' ? 'Personalizado' : 'Padrão'}
              </p>
            </div>
            <Switch checked={modeloAtivo === 'personalizado'} onCheckedChange={handleToggleModelo} disabled={setModelo.isPending} />
          </div>
        </div>
        {modeloAtivo === 'personalizado' && composicoes.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">Nenhum concorrente criado. Crie concorrentes abaixo para que o modelo personalizado funcione corretamente.</p>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Concorrentes do Ranking</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Defina quais OPMs compõem cada concorrente para fins de pontuação, ranking e dashboard.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialog({ mode: 'create' })} className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo Concorrente
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && composicoes.length === 0 && (
          <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
            <Layers className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum concorrente criado</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Concorrente" para definir as composições.</p>
          </div>
        )}

        {sortedComposicoes.map((comp, idx) => {
          const isExpanded = expandedId === comp.id;
          const unidades = comp.unidades_vinculadas || [];
          const { gpms, pels, cias } = countUnidades(unidades);
          const isAtivo = comp.status !== 'inativo';

          return (
            <div key={comp.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${isAtivo ? 'border-border' : 'border-border/40 opacity-60'}`}>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : comp.id)}
              >
                <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {comp.ordem || idx + 1}
                </span>
                <span className="text-muted-foreground flex-shrink-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${!isAtivo ? 'line-through text-muted-foreground' : ''}`}>{comp.nome}</span>
                    {comp.sigla && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{comp.sigla}</Badge>}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isAtivo ? 'bg-green-50 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                      {isAtivo ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {cias > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">{cias} Cia{cias !== 1 ? 's' : ''}</Badge>}
                    {pels > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">{pels} Pel{pels !== 1 ? 's' : ''}</Badge>}
                    {gpms > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">{gpms} GPM{gpms !== 1 ? 's' : ''}</Badge>}
                  </div>
                  {comp.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{comp.descricao}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className={`h-7 w-7 ${isAtivo ? 'text-green-600' : 'text-muted-foreground'}`}
                    title={isAtivo ? 'Desativar' : 'Ativar'} onClick={() => handleToggleStatus(comp)}>
                    <Power className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ mode: 'edit', data: comp })}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(comp)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border px-4 py-3 bg-muted/10">
                  {unidades.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma OPM vinculada ainda.</p>
                  ) : (
                    <SummaryTree unidades={unidades} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {composicoes.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>Concorrentes inativos não participam do ranking. A ordem de exibição segue o campo "Ordem" de cada concorrente.</p>
        </div>
      )}

      {dialog && (
        <ConcorrenteDialog
          mode={dialog.mode}
          initial={dialog.data}
          composicoes={composicoes}
          onClose={() => setDialog(null)}
          onSave={async (data) => {
            if (dialog.mode === 'create') {
              await criarComposicao.mutateAsync(data);
              toast.success('Concorrente criado!');
            } else {
              await atualizarComposicao.mutateAsync({ id: dialog.data.id, data });
              toast.success('Concorrente atualizado!');
            }
            setDialog(null);
          }}
          isSaving={criarComposicao.isPending || atualizarComposicao.isPending}
        />
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Concorrente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja excluir <strong>"{deleteConfirm?.nome}"</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={excluirComposicao.isPending}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryTree({ unidades }) {
  const byBpm = {};
  unidades.forEach(u => {
    if (!byBpm[u.bpm]) byBpm[u.bpm] = {};
    if (u.nivel === 'gpm' && u.companhia) {
      if (!byBpm[u.bpm][u.companhia]) byBpm[u.bpm][u.companhia] = [];
      byBpm[u.bpm][u.companhia].push(`${u.pelotao} / ${u.gpm} — ${u.municipio}`);
    }
  });

  return (
    <div className="space-y-2">
      {Object.entries(byBpm).map(([bpm, cias]) => (
        <div key={bpm}>
          <div className="flex items-center gap-1.5 mb-1">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">{bpm}</span>
          </div>
          <div className="ml-5 space-y-1">
            {Object.entries(cias).map(([cia, gpms]) => (
              <div key={cia}>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">{cia}</span>
                  <span className="text-[10px] text-muted-foreground">({gpms.length} GPMs)</span>
                </div>
                <div className="ml-5 flex flex-wrap gap-1 mt-0.5">
                  {gpms.map((g, i) => (
                    <span key={i} className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5">{g}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConcorrenteDialog({ mode, initial, composicoes, onClose, onSave, isSaving }) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [sigla, setSigla] = useState(initial?.sigla || '');
  const [descricao, setDescricao] = useState(initial?.descricao || '');
  const [ordem, setOrdem] = useState(initial?.ordem || composicoes.length + 1);
  const [selectedKeys, setSelectedKeys] = useState(() => unidadesToSelectedKeys(initial?.unidades_vinculadas));

  const resumo = useMemo(() => calcComposicaoResumo(selectedKeys), [selectedKeys]);
  const gpmsCount = resumo.gpms;

  const handleSave = () => {
    if (!nome.trim()) { toast.error('Nome obrigatório'); return; }
    if (gpmsCount === 0) { toast.error('Selecione ao menos uma OPM na árvore'); return; }
    const unidades = selectedKeysToUnidades(selectedKeys);
    onSave({
      nome: nome.trim(),
      sigla: sigla.trim(),
      descricao: descricao.trim(),
      ordem: Number(ordem) || 99,
      unidades_vinculadas: unidades,
      tipo_nivel: 'gpm',
      status: initial?.status || 'ativo',
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Concorrente' : 'Editar Concorrente'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: 1ª Cia Rio Pardo + Pels" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Sigla</Label>
              <Input value={sigla} onChange={e => setSigla(e.target.value)} placeholder="Ex: 1CIA-RP" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ordem</Label>
              <Input type="number" min={1} value={ordem} onChange={e => setOrdem(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve descrição do concorrente" className="mt-1" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Composição de OPMs *</Label>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gpmsCount > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {gpmsCount} GPM{gpmsCount !== 1 ? 's' : ''} selecionado{gpmsCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
              Selecione os nós na árvore. Marcar um BPM/Cia/Pel inclui todos os subordinados automaticamente.
              Toda a pontuação das unidades marcadas será consolidada neste único concorrente — sem duplicidade.
            </p>

            {/* Resumo automático da composição */}
            {gpmsCount > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                  <Users className="w-3.5 h-3.5 text-green-600 mx-auto mb-0.5" />
                  <p className="text-lg font-black text-green-700">{resumo.cias}</p>
                  <p className="text-[10px] text-green-600 font-semibold">CIA{resumo.cias !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                  <User className="w-3.5 h-3.5 text-blue-600 mx-auto mb-0.5" />
                  <p className="text-lg font-black text-blue-700">{resumo.pels}</p>
                  <p className="text-[10px] text-blue-600 font-semibold">Pelotão{resumo.pels !== 1 ? 'es' : ''}</p>
                </div>
                <div className="bg-muted border border-border rounded-lg px-3 py-2 text-center">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-lg font-black text-foreground">{resumo.gpms}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold">GPMs</p>
                </div>
              </div>
            )}

            <OrgTree selected={selectedKeys} onChange={setSelectedKeys} />
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Check className="w-4 h-4 mr-1" />
            {mode === 'create' ? 'Criar Concorrente' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}