import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { FileSpreadsheet, Plus, Pencil, Trash2, Link2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function PlanilhasHistoricasAdmin() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null); // null | 'new' | registro
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [form, setForm] = useState({ descricao: '', link: '' });
  const [saving, setSaving] = useState(false);

  const { data: planilhasRaw = [], isLoading } = useQuery({
    queryKey: ['planilhas-historicas'],
    queryFn: () => base44.entities.PlanilhaHistorico.list(),
  });

  // Ordena pela data de criação, mais recente primeiro
  const planilhas = [...planilhasRaw].sort(
    (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
  );

  const openNew = () => {
    setForm({ descricao: '', link: '' });
    setDialog('new');
  };

  const openEdit = (p) => {
    setForm({ descricao: p.descricao || '', link: p.link || '' });
    setDialog(p);
  };

  const handleSave = async () => {
    if (!form.descricao.trim() || !form.link.trim()) {
      toast.error('Preencha a descrição e o link');
      return;
    }
    setSaving(true);
    try {
      const data = { descricao: form.descricao.trim(), link: form.link.trim() };
      if (dialog === 'new') {
        await base44.entities.PlanilhaHistorico.create(data);
        toast.success('Planilha adicionada com sucesso!');
      } else {
        await base44.entities.PlanilhaHistorico.update(dialog.id, data);
        toast.success('Planilha atualizada com sucesso!');
      }
      await queryClient.invalidateQueries({ queryKey: ['planilhas-historicas'] });
      setDialog(null);
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await base44.entities.PlanilhaHistorico.delete(deleteDialog.id);
      await queryClient.invalidateQueries({ queryKey: ['planilhas-historicas'] });
      toast.success('Planilha removida com sucesso!');
    } catch (err) {
      toast.error('Erro ao remover: ' + (err?.message || ''));
    } finally {
      setDeleteDialog(null);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Planilhas de Trimestres Anteriores
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cadastre links de planilhas (ex: Google Drive) para cada trimestre anterior. Todos os usuários
            verão essa lista na aba "Backups Trimestrais" e poderão baixar.
          </p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5 flex-shrink-0"><Plus className="w-3.5 h-3.5" /> Novo</Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <p className="px-4 py-8 text-sm text-muted-foreground text-center">Carregando...</p>
        ) : planilhas.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground text-center">Nenhuma planilha cadastrada ainda</p>
        ) : (
          <div className="divide-y divide-border">
            {planilhas.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.descricao}</p>
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5 truncate">
                    <Link2 className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{p.link}</span> <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDialog(p)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === 'new' ? 'Nova Planilha' : 'Editar Planilha'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Descrição do Trimestre</Label>
              <Input
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: 3º Trimestre de 2025 (Jul-Set)"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Link da Planilha</Label>
              <Input
                value={form.link}
                onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Planilha</DialogTitle>
            <DialogDescription>
              Deseja remover a planilha "{deleteDialog?.descricao}"? Os usuários não poderão mais baixá-la pelo sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
