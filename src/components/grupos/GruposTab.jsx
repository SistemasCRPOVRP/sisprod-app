import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGruposConcorrentes, useGruposMutations } from '@/hooks/useGruposConcorrentes';
import GrupoCard from './GrupoCard';
import GrupoDialog from './GrupoDialog';

export default function GruposTab({ tipoNivel, tipoLabel }) {
  const { grupos, isLoading } = useGruposConcorrentes(tipoNivel);
  const { criar, atualizar, excluir } = useGruposMutations();
  const [dialog, setDialog] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null); // Para bloqueio de toggle duplo

  const sorted = useMemo(() =>
    [...grupos].sort((a, b) => (a.ordem || 99) - (b.ordem || 99)),
    [grupos]
  );

  const filtered = useMemo(() =>
    sorted.filter(g => !search ||
      g.nome?.toLowerCase().includes(search.toLowerCase()) ||
      g.municipio?.toLowerCase().includes(search.toLowerCase())
    ),
    [sorted, search]
  );

  const logAudit = useCallback(async (acao, grupo, detalhe) => {
    try {
      const me = await base44.auth.me();
      await base44.entities.AuditLog.create({
        usuario: me?.email || 'sistema',
        acao,
        tabela: 'RankingComposicao',
        registro_id: grupo?.id || '',
        detalhe: detalhe || `${tipoLabel}: ${grupo?.nome || ''}`,
      });
    } catch {}
  }, [tipoLabel]);

  const handleSave = useCallback(async (data) => {
    if (dialog.mode === 'create') {
      const novo = await criar.mutateAsync(data);
      logAudit('criou', novo, `Grupo ${tipoLabel} criado: ${data.nome}`);
      toast.success(`Grupo "${data.nome}" criado!`);
    } else {
      await atualizar.mutateAsync({ id: dialog.data.id, data });
      logAudit('editou', { id: dialog.data.id, nome: data.nome }, `Grupo ${tipoLabel} editado: ${data.nome}`);
      toast.success('Grupo atualizado!');
    }
    setDialog(null);
  }, [dialog, criar, atualizar, tipoLabel, logAudit]);

  const handleDuplicate = useCallback(async (grupo) => {
    const { id, created_date, updated_date, created_by, ...rest } = grupo;
    const novo = { ...rest, nome: `${grupo.nome} (cópia)`, status: 'inativo', ordem: grupos.length + 1 };
    const criado = await criar.mutateAsync(novo);
    logAudit('criou', criado, `Grupo ${tipoLabel} duplicado de: ${grupo.nome}`);
    toast.success(`Grupo duplicado como "${novo.nome}"`);
  }, [criar, grupos, tipoLabel, logAudit]);

  const handleToggleStatus = useCallback(async (grupo) => {
    if (togglingId === grupo.id) return; // Bloqueia clique duplo
    setTogglingId(grupo.id);
    const novoStatus = grupo.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await atualizar.mutateAsync({ id: grupo.id, data: { ...grupo, status: novoStatus } });
      logAudit('editou', grupo, `Status alterado para ${novoStatus}: ${grupo.nome}`);
      toast.success(novoStatus === 'ativo' ? 'Grupo ativado' : 'Grupo desativado');
    } finally {
      setTogglingId(null);
    }
  }, [togglingId, atualizar, logAudit]);

  const handleDelete = useCallback(async () => {
    try {
      await excluir.mutateAsync(deleteConfirm.id);
      logAudit('excluiu', deleteConfirm, `Grupo ${tipoLabel} excluído: ${deleteConfirm.nome}`);
      toast.success('Grupo excluído');
    } catch (err) {
      if (err?.message?.includes('not found')) {
        toast.info('Grupo já havia sido excluído.');
      } else {
        throw err;
      }
    } finally {
      setDeleteConfirm(null);
    }
  }, [excluir, deleteConfirm, tipoLabel, logAudit]);

  const ativos = grupos.filter(g => g.status !== 'inativo').length;
  const inativos = grupos.filter(g => g.status === 'inativo').length;
  const isSaving = criar.isPending || atualizar.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            {ativos} ativo{ativos !== 1 ? 's' : ''}
            {inativos > 0 ? `, ${inativos} inativo${inativos !== 1 ? 's' : ''}` : ''}
            {' · '}{grupos.length} grupo{grupos.length !== 1 ? 's' : ''} no total
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar grupos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-48"
            />
          </div>
          <Button
            size="sm"
            onClick={() => setDialog({ mode: 'create' })}
            className="gap-1.5"
            disabled={isSaving}
          >
            <Plus className="w-4 h-4" /> Novo Grupo
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <Layers className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          {search ? (
            <p className="text-sm text-muted-foreground">Nenhum grupo encontrado para "{search}"</p>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">Nenhum grupo de {tipoLabel} criado</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Grupo" para criar o primeiro grupo.</p>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((grupo, idx) => (
          <GrupoCard
            key={grupo.id}
            grupo={grupo}
            idx={idx}
            onEdit={(g) => setDialog({ mode: 'edit', data: g })}
            onDelete={setDeleteConfirm}
            onToggleStatus={handleToggleStatus}
            onDuplicate={handleDuplicate}
            isToggling={togglingId === grupo.id}
          />
        ))}
      </div>

      {/* Dialog de criação/edição */}
      {dialog && (
        <GrupoDialog
          mode={dialog.mode}
          initial={dialog.data}
          tipoNivel={tipoNivel}
          onClose={() => !isSaving && setDialog(null)}
          onSave={handleSave}
          isSaving={isSaving}
          ordemSugerida={grupos.length + 1}
        />
      )}

      {/* Confirmação de exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => !excluir.isPending && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Grupo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja excluir o grupo <strong>"{deleteConfirm?.nome}"</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={excluir.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={excluir.isPending}>
              {excluir.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {excluir.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
